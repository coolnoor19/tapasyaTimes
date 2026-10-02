import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { eq } from "drizzle-orm"
import { db } from "../../src/db/index.js"
import { usersTable, verificationTokensTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { clearOutbox, extractCode, mailsTo, settle, waitForMail } from "../helpers/mailbox.js"

vi.mock("../../src/mail/mailer.js", () => import("../helpers/mailbox.js"))

const { createApp } = await import("../../src/app.js")
const app = createApp()

const EMAIL = "noor@example.com"
const INVALID = { message: "Invalid or expired code" }

const verify = (email: string, code: string) => request(app).post("/api/v1/auth/verify-email").send({ email, code })
const resend = (email: string) => request(app).post("/api/v1/auth/resend-verification").send({ email })

async function register(email = EMAIL, phone = "9876543210") {
    await request(app)
        .post("/api/v1/auth/register")
        .send({ firstName: "Noor", lastName: "Alam", email, phone, password: "password123" })
    return extractCode(await waitForMail(email))
}

const getUser = async (email = EMAIL) =>
    (await db.select().from(usersTable).where(eq(usersTable.email, email)))[0]!
const getTokens = () => db.select().from(verificationTokensTable)
const wrongCode = (real: string) => (real === "000000" ? "000001" : "000000")

describe.skipIf(!hasTestDb)("email verification (OTP)", () => {
    beforeEach(async () => {
        await resetDb()
        clearOutbox()
    })
    afterAll(closeDb)

    describe("POST /verify-email", () => {
        it("verifies the user with the correct code", async () => {
            const code = await register()

            const res = await verify(EMAIL, code)

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ message: "Email verified" })
            expect((await getUser()).isVerified).toBe(true)
            expect((await getTokens())[0]!.usedAt).not.toBeNull()
        })

        it("rejects a wrong code and leaves the user unverified", async () => {
            const code = await register()

            const res = await verify(EMAIL, wrongCode(code))

            expect(res.status).toBe(400)
            expect(res.body).toEqual(INVALID)
            expect((await getUser()).isVerified).toBe(false)
        })

        it("gives the same answer for an unknown email as for a wrong code (no account discovery)", async () => {
            const code = await register()
            const wrong = await verify(EMAIL, wrongCode(code))
            const unknown = await verify("nobody@example.com", "123456")

            expect(unknown.status).toBe(wrong.status)
            expect(unknown.body).toEqual(wrong.body)
        })

        it("rejects reuse of a code that already worked", async () => {
            const code = await register()
            await verify(EMAIL, code)

            const again = await verify(EMAIL, code)

            expect(again.status).toBe(400)
            expect(again.body).toEqual(INVALID)
        })

        it("rejects an expired code", async () => {
            const code = await register()
            await db.update(verificationTokensTable).set({ expiresAt: new Date(Date.now() - 1000) })

            const res = await verify(EMAIL, code)

            expect(res.status).toBe(400)
            expect((await getUser()).isVerified).toBe(false)
        })

        it("rejects a malformed code before touching the database", async () => {
            const res = await verify(EMAIL, "12345")
            expect(res.status).toBe(400)
            expect(res.body.message).toContain("code")
        })

        it("does not accept one user's code for another user", async () => {
            const codeA = await register("a@example.com", "9111111111")
            await register("b@example.com", "9222222222")

            const res = await verify("b@example.com", codeA)

            expect(res.status).toBe(400)
            expect((await getUser("b@example.com")).isVerified).toBe(false)
        })
    })

    describe("guess limit (6-digit codes must not be brute-forceable)", () => {
        it("still accepts the right code after 4 wrong guesses", async () => {
            const code = await register()
            for (let i = 0; i < 4; i++) await verify(EMAIL, wrongCode(code))

            expect((await verify(EMAIL, code)).status).toBe(200)
        })

        it("kills the code after 5 wrong guesses, even if the next one is right", async () => {
            const code = await register()
            for (let i = 0; i < 5; i++) await verify(EMAIL, wrongCode(code))

            const res = await verify(EMAIL, code)

            expect(res.status).toBe(400)
            expect((await getUser()).isVerified).toBe(false)
            expect((await getTokens())[0]!.attempts).toBe(5)
        })

        it("never allows more than 5 attempts even when 12 guesses arrive at the same time", async () => {
            const code = await register()

            const results = await Promise.all(Array.from({ length: 12 }, () => verify(EMAIL, wrongCode(code))))

            expect(results.every((r) => r.status === 400)).toBe(true)
            expect((await getTokens())[0]!.attempts).toBe(5)
            expect((await verify(EMAIL, code)).status).toBe(400)
        })

        it("lets a new code work after the old one was locked out", async () => {
            const oldCode = await register()
            for (let i = 0; i < 5; i++) await verify(EMAIL, wrongCode(oldCode))
            // Move the last send past the 60s cooldown
            await db.update(verificationTokensTable).set({ createdAt: new Date(Date.now() - 120_000) })

            await resend(EMAIL)
            const newCode = extractCode(await waitForMail(EMAIL, 2))

            expect((await verify(EMAIL, newCode)).status).toBe(200)
        })
    })

    describe("POST /resend-verification", () => {
        const GENERIC = { message: "If the account exists and is not verified, a new code has been sent" }

        it("does not send a second email within the 60 second cooldown", async () => {
            await register()

            const res = await resend(EMAIL)
            await settle()

            expect(res.status).toBe(200)
            expect(mailsTo(EMAIL)).toHaveLength(1)
        })

        it("sends a new code after the cooldown and invalidates the old one", async () => {
            const oldCode = await register()
            await db.update(verificationTokensTable).set({ createdAt: new Date(Date.now() - 120_000) })

            await resend(EMAIL)
            const newCode = extractCode(await waitForMail(EMAIL, 2))

            expect((await verify(EMAIL, oldCode)).status).toBe(400)
            expect((await verify(EMAIL, newCode)).status).toBe(200)
        })

        it("keeps only one usable code at a time", async () => {
            await register()
            await db.update(verificationTokensTable).set({ createdAt: new Date(Date.now() - 120_000) })
            await resend(EMAIL)
            await waitForMail(EMAIL, 2)

            const active = (await getTokens()).filter((t) => t.usedAt === null)
            expect(active).toHaveLength(1)
        })

        it("answers identically for unknown, unverified and verified accounts, and only emails the unverified one", async () => {
            await register("pending@example.com", "9111111111")
            const code = await register("done@example.com", "9222222222")
            await verify("done@example.com", code)
            await db.update(verificationTokensTable).set({ createdAt: new Date(Date.now() - 120_000) })
            clearOutbox()

            const unknown = await resend("nobody@example.com")
            const verified = await resend("done@example.com")
            const pending = await resend("pending@example.com")
            await waitForMail("pending@example.com")
            await settle()

            for (const res of [unknown, verified, pending]) {
                expect(res.status).toBe(200)
                expect(res.body).toEqual(GENERIC)
            }
            expect(mailsTo("nobody@example.com")).toHaveLength(0)
            expect(mailsTo("done@example.com")).toHaveLength(0)
            expect(mailsTo("pending@example.com")).toHaveLength(1)
        })

        it("does not email a suspended account", async () => {
            await register()
            await db.update(usersTable).set({ status: "SUSPENDED" })
            await db.update(verificationTokensTable).set({ createdAt: new Date(Date.now() - 120_000) })

            await resend(EMAIL)
            await settle()

            expect(mailsTo(EMAIL)).toHaveLength(1)
        })
    })

    describe("code storage", () => {
        it("stores only a hash of the code, never the code itself", async () => {
            const code = await register()
            const [token] = await getTokens()

            expect(token!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
            expect(token!.tokenHash).not.toContain(code)
            expect(JSON.stringify(token)).not.toContain(`"${code}"`)
        })

        it("sets an expiry roughly 10 minutes ahead", async () => {
            await register()
            const [token] = await getTokens()
            const minutes = (token!.expiresAt.getTime() - Date.now()) / 60_000
            expect(minutes).toBeGreaterThan(9)
            expect(minutes).toBeLessThanOrEqual(10)
        })
    })
})
