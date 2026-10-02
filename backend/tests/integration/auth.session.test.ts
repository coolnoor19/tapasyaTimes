import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { isNotNull } from "drizzle-orm"
import { SignJWT } from "jose"
import { createApp } from "../../src/app.js"
import { env } from "../../src/config/env.js"
import { db } from "../../src/db/index.js"
import { refreshTokensTable, usersTable } from "../../src/db/schema.js"
import { signAccessToken } from "../../src/utils/token.util.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { cookieHeader, createVerifiedUser, PASSWORD, refreshCookieLine, refreshCookieValue } from "../helpers/auth.js"

const app = createApp()

async function loginAs(email: string) {
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD })
    return { accessToken: res.body.accessToken as string, cookie: refreshCookieValue(res)! }
}

const refresh = (cookie?: string) => {
    const req = request(app).post("/api/v1/auth/refresh")
    return cookie === undefined ? req : req.set("Cookie", cookieHeader(cookie))
}
const logout = (cookie?: string) => {
    const req = request(app).post("/api/v1/auth/logout")
    return cookie === undefined ? req : req.set("Cookie", cookieHeader(cookie))
}
const me = (token?: string) => {
    const req = request(app).get("/api/v1/auth/me")
    return token === undefined ? req : req.set("Authorization", `Bearer ${token}`)
}

const INVALID_SESSION = { message: "Invalid or expired session", code: "SESSION_INVALID" }
const allTokens = () => db.select().from(refreshTokensTable)

describe.skipIf(!hasTestDb)("sessions", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("GET /auth/me (access token)", () => {
        it("returns the current user", async () => {
            const user = await createVerifiedUser({ email: "noor@example.com" })
            const { accessToken } = await loginAs("noor@example.com")

            const res = await me(accessToken)

            expect(res.status).toBe(200)
            expect(res.body).toEqual({
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: "noor@example.com",
                phone: user.phone,
                role: "USER",
                isVerified: true,
            })
        })

        it.each([
            ["no Authorization header", undefined],
            ["a garbage token", "not-a-token"],
        ])("rejects %s with 401", async (_label, token) => {
            const res = await me(token)
            expect(res.status).toBe(401)
        })

        it("rejects the wrong scheme (Basic instead of Bearer)", async () => {
            const res = await request(app).get("/api/v1/auth/me").set("Authorization", "Basic abc")
            expect(res.status).toBe(401)
            expect(res.body.code).toBe("AUTH_REQUIRED")
        })

        it("tells the frontend when the token EXPIRED so it knows to refresh", async () => {
            const user = await createVerifiedUser()
            const expired = await new SignJWT({})
                .setProtectedHeader({ alg: "HS256" })
                .setSubject(user.id)
                .setIssuer("tapasya-times")
                .setAudience("tapasya-times-api")
                .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
                .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
                .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET))

            const res = await me(expired)

            expect(res.status).toBe(401)
            expect(res.body.code).toBe("TOKEN_EXPIRED")
        })

        it("rejects a valid token whose user no longer exists", async () => {
            const ghost = await signAccessToken("00000000-0000-4000-8000-000000000000")
            expect((await me(ghost)).status).toBe(401)
        })

        it("stops working immediately when the user is suspended (no waiting for expiry)", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { accessToken } = await loginAs("noor@example.com")
            expect((await me(accessToken)).status).toBe(200)

            await db.update(usersTable).set({ status: "SUSPENDED" })

            expect((await me(accessToken)).status).toBe(401)
        })

        it("reflects a role change immediately", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { accessToken } = await loginAs("noor@example.com")

            await db.update(usersTable).set({ role: "MANAGER" })

            expect((await me(accessToken)).body.role).toBe("MANAGER")
        })
    })

    describe("POST /auth/refresh (rotation)", () => {
        it("issues a new access token and a NEW refresh cookie", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")

            const res = await refresh(cookie)

            expect(res.status).toBe(200)
            expect(res.body.accessToken).toEqual(expect.any(String))
            expect((await me(res.body.accessToken)).status).toBe(200)
            const newCookie = refreshCookieValue(res)!
            expect(newCookie).toBeTruthy()
            expect(newCookie).not.toBe(cookie)
            expect(refreshCookieLine(res)).toContain("HttpOnly")
            expect(JSON.stringify(res.body)).not.toContain(newCookie)
        })

        it("links the old token to its replacement and revokes it", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")
            await refresh(cookie)

            const tokens = await allTokens()
            expect(tokens).toHaveLength(2)
            const old = tokens.find((t) => t.revokedAt)!
            const fresh = tokens.find((t) => !t.revokedAt)!
            expect(old.replacedById).toBe(fresh.id)
        })

        it("can be chained: every new cookie works exactly once", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            let { cookie } = await loginAs("noor@example.com")
            for (let i = 0; i < 3; i++) {
                const res = await refresh(cookie)
                expect(res.status).toBe(200)
                cookie = refreshCookieValue(res)!
            }
        })

        it("rejects a missing cookie, a garbage cookie and an expired token with the same 401", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")
            await db.update(refreshTokensTable).set({ expiresAt: new Date(Date.now() - 1000) })

            for (const attempt of [refresh(), refresh("garbage"), refresh(cookie)]) {
                const res = await attempt
                expect(res.status).toBe(401)
                expect(res.body).toEqual(INVALID_SESSION)
            }
        })

        it("clears the cookie when the session is invalid", async () => {
            const res = await refresh("garbage")
            expect(refreshCookieValue(res)).toBe("")
            expect(refreshCookieLine(res)).toMatch(/Expires=Thu, 01 Jan 1970/)
        })

        it("refuses to refresh for a suspended user", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")
            await db.update(usersTable).set({ status: "SUSPENDED" })

            expect((await refresh(cookie)).status).toBe(401)
        })

        it("lets only ONE of 6 simultaneous refreshes with the same token succeed", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")

            const results = await Promise.all(Array.from({ length: 6 }, () => refresh(cookie)))

            const winners = results.filter((r) => r.status === 200)
            expect(winners).toHaveLength(1)
            expect(results.filter((r) => r.status === 401)).toHaveLength(5)
            // Losing a race is not treated as theft: the winner's new cookie still works.
            expect((await refresh(refreshCookieValue(winners[0]!)!)).status).toBe(200)
        })
    })

    describe("stolen refresh token detection", () => {
        // Pretend the rotation / logout happened a minute ago (outside the 10s race window).
        const backdateRevocations = () =>
            db.update(refreshTokensTable).set({ revokedAt: new Date(Date.now() - 60_000) }).where(isNotNull(refreshTokensTable.revokedAt))

        it("a quick reuse of a rotated token is just refused (two tabs racing)", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie: first } = await loginAs("noor@example.com")
            const second = refreshCookieValue(await refresh(first))!

            expect((await refresh(first)).status).toBe(401)

            expect((await refresh(second)).status).toBe(200) // legitimate session survives
        })

        it("reuse of a rotated token long after rotation ends EVERY session of that user", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie: stolen } = await loginAs("noor@example.com")
            const { cookie: otherDevice } = await loginAs("noor@example.com")
            const legit = refreshCookieValue(await refresh(stolen))!
            await backdateRevocations()

            // the attacker replays the old token
            expect((await refresh(stolen)).status).toBe(401)

            expect((await refresh(legit)).status).toBe(401)
            expect((await refresh(otherDevice)).status).toBe(401)
            expect((await allTokens()).every((t) => t.revokedAt !== null)).toBe(true)
        })

        it("does not touch other users' sessions", async () => {
            await createVerifiedUser({ email: "victim@example.com" })
            await createVerifiedUser({ email: "bystander@example.com" })
            const { cookie: stolen } = await loginAs("victim@example.com")
            const { cookie: bystander } = await loginAs("bystander@example.com")
            await refresh(stolen)
            await backdateRevocations()

            await refresh(stolen) // replay

            expect((await refresh(bystander)).status).toBe(200)
        })

        it("replaying a token that was merely logged out is not treated as theft", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie: phone } = await loginAs("noor@example.com")
            const { cookie: laptop } = await loginAs("noor@example.com")
            await logout(phone)
            await backdateRevocations()

            expect((await refresh(phone)).status).toBe(401)

            expect((await refresh(laptop)).status).toBe(200) // other device unaffected
        })
    })

    describe("logout", () => {
        it("revokes the refresh token and clears the cookie", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")

            const res = await logout(cookie)

            expect(res.status).toBe(200)
            expect(refreshCookieValue(res)).toBe("")
            expect((await refresh(cookie)).status).toBe(401)
        })

        it("succeeds even without a cookie", async () => {
            expect((await logout()).status).toBe(200)
        })

        it("only ends the current device", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const phone = await loginAs("noor@example.com")
            const laptop = await loginAs("noor@example.com")

            await logout(phone.cookie)

            expect((await refresh(laptop.cookie)).status).toBe(200)
        })

        it("logout-all ends every device and needs a valid access token", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const phone = await loginAs("noor@example.com")
            const laptop = await loginAs("noor@example.com")

            expect((await request(app).post("/api/v1/auth/logout-all")).status).toBe(401)
            const res = await request(app).post("/api/v1/auth/logout-all").set("Authorization", `Bearer ${phone.accessToken}`)

            expect(res.status).toBe(200)
            expect((await refresh(phone.cookie)).status).toBe(401)
            expect((await refresh(laptop.cookie)).status).toBe(401)
        })
    })

    describe("cross-site request protection", () => {
        it("refuses refresh and logout requests that come from another website", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")

            for (const path of ["refresh", "logout"]) {
                const res = await request(app)
                    .post(`/api/v1/auth/${path}`)
                    .set("Origin", "https://evil.example")
                    .set("Cookie", cookieHeader(cookie))
                expect(res.status).toBe(403)
            }
            // and the session was not consumed or revoked by those attempts
            expect((await refresh(cookie)).status).toBe(200)
        })

        it("accepts requests from the configured frontend origin", async () => {
            await createVerifiedUser({ email: "noor@example.com" })
            const { cookie } = await loginAs("noor@example.com")

            const res = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Origin", "http://localhost:3000")
                .set("Cookie", cookieHeader(cookie))

            expect(res.status).toBe(200)
        })
    })
})
