import { createHash } from "node:crypto"
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { eq } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { refreshTokensTable, usersTable } from "../../src/db/schema.js"
import { verifyAccessToken } from "../../src/utils/token.util.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser, PASSWORD, refreshCookieLine, refreshCookieValue } from "../helpers/auth.js"

const app = createApp()
const login = (email: string, password: string = PASSWORD) => request(app).post("/api/v1/auth/login").send({ email, password })
const getUser = async (email: string) => (await db.select().from(usersTable).where(eq(usersTable.email, email)))[0]!

const GENERIC = { message: "Invalid email or password" }

describe.skipIf(!hasTestDb)("POST /api/v1/auth/login", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("successful login", () => {
        it("returns an access token and the public user", async () => {
            const user = await createVerifiedUser({ email: "noor@example.com", firstName: "Noor", lastName: "Alam" })

            const res = await login("noor@example.com")

            expect(res.status).toBe(200)
            expect(res.body).toEqual({
                accessToken: expect.any(String),
                tokenType: "Bearer",
                expiresIn: 900,
                user: { id: user.id, firstName: "Noor", lastName: "Alam", email: "noor@example.com", role: "USER" },
            })
            expect(await verifyAccessToken(res.body.accessToken)).toBe(user.id)
        })

        it("never returns the password hash or lockout fields", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const res = await login("noor@example.com")
            expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|lockedUntil|failedLogin/)
        })

        it("is not cached by browsers or proxies", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            expect((await login("noor@example.com")).headers["cache-control"]).toBe("no-store")
        })

        it("accepts the email in any letter case", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            expect((await login("  NOOR@Example.COM ")).status).toBe(200)
        })

        it("reports the real role", async () => {
            await createVerifiedUser({ email: "boss@example.com", role: "ADMIN" })
            expect((await login("boss@example.com")).body.user.role).toBe("ADMIN")
        })
    })

    describe("refresh token cookie", () => {
        it("is httpOnly, SameSite=Strict, scoped to /api/v1/auth and lasts 30 days", async () => {
            await createVerifiedUser({ email: "noor@example.com" })

            const line = refreshCookieLine(await login("noor@example.com"))!

            expect(line).toContain("HttpOnly")
            expect(line).toContain("SameSite=Strict")
            expect(line).toContain("Path=/api/v1/auth")
            expect(line).toContain("Max-Age=2592000")
            expect(line).not.toContain("Secure") // only in production (HTTP in tests)
        })

        it("is never included in the response body", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const res = await login("noor@example.com")
            const cookie = refreshCookieValue(res)!

            expect(cookie.length).toBeGreaterThanOrEqual(40)
            expect(JSON.stringify(res.body)).not.toContain(cookie)
        })

        it("is stored only as a SHA-256 hash, with a 30 day expiry", async () => {
            const user = await createVerifiedUser({ email: "noor@example.com" })
            const cookie = refreshCookieValue(await login("noor@example.com"))!

            const [row] = await db.select().from(refreshTokensTable).where(eq(refreshTokensTable.userId, user.id))

            expect(row!.tokenHash).toBe(createHash("sha256").update(cookie).digest("hex"))
            expect(row!.tokenHash).not.toContain(cookie)
            expect(row!.revokedAt).toBeNull()
            const days = (row!.expiresAt.getTime() - Date.now()) / 86_400_000
            expect(days).toBeGreaterThan(29.9)
            expect(days).toBeLessThanOrEqual(30)
        })

        it("is different for every login", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const a = refreshCookieValue(await login("noor@example.com"))
            const b = refreshCookieValue(await login("noor@example.com"))
            expect(a).not.toBe(b)
        })
    })

    describe("failed login (no account discovery)", () => {
        it("gives the same response for a wrong password and an unknown email", async () => {
            await createVerifiedUser({ email: "noor@example.com" })

            const wrong = await login("noor@example.com", "wrong-password")
            const unknown = await login("nobody@example.com")

            expect(wrong.status).toBe(401)
            expect(unknown.status).toBe(401)
            expect(wrong.body).toEqual(GENERIC)
            expect(unknown.body).toEqual(GENERIC)
        })

        it("sets no cookie on failure", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            expect(refreshCookieLine(await login("noor@example.com", "wrong-password"))).toBeUndefined()
        })

        it("validates the body", async () => {
            expect((await request(app).post("/api/v1/auth/login").send({ email: "x" })).status).toBe(400)
            expect((await request(app).post("/api/v1/auth/login").send({ email: "a@b.com", password: "" })).status).toBe(400)
        })
    })

    describe("account state (only revealed after a correct password)", () => {
        it("refuses an unverified email with EMAIL_NOT_VERIFIED", async () => {
            await createVerifiedUser({ email: "new@example.com", isVerified: false })

            const res = await login("new@example.com")

            expect(res.status).toBe(403)
            expect(res.body.code).toBe("EMAIL_NOT_VERIFIED")
            expect(refreshCookieLine(res)).toBeUndefined()
        })

        it("does not reveal that an account is unverified when the password is wrong", async () => {
            await createVerifiedUser({ email: "new@example.com", isVerified: false })
            const res = await login("new@example.com", "wrong-password")
            expect(res.status).toBe(401)
            expect(res.body).toEqual(GENERIC)
        })

        it("refuses a suspended account", async () => {
            await createVerifiedUser({ email: "bad@example.com", status: "SUSPENDED" })
            const res = await login("bad@example.com")
            expect(res.status).toBe(403)
            expect(res.body.code).toBe("ACCOUNT_SUSPENDED")
        })
    })

    describe("lockout after repeated wrong passwords", () => {
        it("locks the account for ~15 minutes after 5 wrong passwords, even for the right password", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            for (let i = 0; i < 5; i++) await login("noor@example.com", "wrong-password")

            const user = await getUser("noor@example.com")
            expect(user.failedLoginAttempts).toBe(5)
            const minutes = (user.lockedUntil!.getTime() - Date.now()) / 60_000
            expect(minutes).toBeGreaterThan(14)
            expect(minutes).toBeLessThanOrEqual(15)

            const res = await login("noor@example.com")
            expect(res.status).toBe(401)
            expect(res.body).toEqual(GENERIC) // locked looks identical to a wrong password
        })

        it("does not lock after only 4 wrong passwords", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            for (let i = 0; i < 4; i++) await login("noor@example.com", "wrong-password")

            expect((await getUser("noor@example.com")).lockedUntil).toBeNull()
            expect((await login("noor@example.com")).status).toBe(200)
        })

        it("resets the counter after a successful login", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            for (let i = 0; i < 3; i++) await login("noor@example.com", "wrong-password")
            await login("noor@example.com")

            expect((await getUser("noor@example.com")).failedLoginAttempts).toBe(0)
        })

        it("does not count (or extend) attempts made while locked", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            for (let i = 0; i < 5; i++) await login("noor@example.com", "wrong-password")
            const before = await getUser("noor@example.com")

            for (let i = 0; i < 3; i++) await login("noor@example.com", "wrong-password")
            const after = await getUser("noor@example.com")

            expect(after.failedLoginAttempts).toBe(5)
            expect(after.lockedUntil!.getTime()).toBe(before.lockedUntil!.getTime())
        })

        it("lets the user in again once the lock has expired, and clears it", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            for (let i = 0; i < 5; i++) await login("noor@example.com", "wrong-password")
            await db.update(usersTable).set({ lockedUntil: new Date(Date.now() - 1000) })

            expect((await login("noor@example.com")).status).toBe(200)

            const user = await getUser("noor@example.com")
            expect(user).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null })
        })

        it("starts counting from zero after a lock expires (one wrong try does not re-lock)", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            for (let i = 0; i < 5; i++) await login("noor@example.com", "wrong-password")
            await db.update(usersTable).set({ lockedUntil: new Date(Date.now() - 1000) })

            await login("noor@example.com", "wrong-password")

            const user = await getUser("noor@example.com")
            expect(user.failedLoginAttempts).toBe(1)
            expect(user.lockedUntil).toBeNull()
        })

        it("locks even when the wrong guesses arrive all at once", async () => {
            await createVerifiedUser({ email: "noor@example.com" })

            await Promise.all(Array.from({ length: 10 }, () => login("noor@example.com", "wrong-password")))

            const user = await getUser("noor@example.com")
            expect(user.failedLoginAttempts).toBeGreaterThanOrEqual(5)
            expect(user.lockedUntil).not.toBeNull()
            expect((await login("noor@example.com")).status).toBe(401)
        })

        it("locks only the targeted account", async () => {
            await createVerifiedUser({ email: "victim@example.com" })
            await createVerifiedUser({ email: "other@example.com" })
            for (let i = 0; i < 5; i++) await login("victim@example.com", "wrong-password")

            expect((await login("other@example.com")).status).toBe(200)
        })
    })
})
