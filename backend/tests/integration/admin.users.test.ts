import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { eq } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { auditLogsTable, refreshTokensTable, usersTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { cookieHeader, createVerifiedUser, PASSWORD, refreshCookieValue } from "../helpers/auth.js"
import { api, userWithToken } from "../helpers/admin.js"
import { futureDate, postBooking, setupWorld } from "../helpers/booking.js"

const app = createApp()
const audits = () => db.select().from(auditLogsTable)
const getUser = async (id: string) => (await db.select().from(usersTable).where(eq(usersTable.id, id)))[0]!

async function loginAs(email: string) {
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: PASSWORD })
    return { res, accessToken: res.body.accessToken as string, cookie: refreshCookieValue(res)! }
}

describe.skipIf(!hasTestDb)("admin: users", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("GET /admin/users", () => {
        it("lists users newest first, paginated, and never exposes secrets", async () => {
            const { token } = await userWithToken("ADMIN")
            for (let i = 0; i < 4; i++) await createVerifiedUser({ email: `u${i}@example.com`, firstName: `User${i}` })

            const page1 = await api(app, token).get("/admin/users?limit=3")
            const page2 = await api(app, token).get("/admin/users?limit=3&page=2")

            expect(page1.status).toBe(200)
            expect(page1.body).toMatchObject({ page: 1, limit: 3, total: 5 })
            expect(page1.body.data).toHaveLength(3)
            expect(page2.body.data).toHaveLength(2)
            expect(new Set([...page1.body.data, ...page2.body.data].map((u: { id: string }) => u.id)).size).toBe(5)
            expect(JSON.stringify(page1.body)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|failedLogin|lockedUntil|tokenHash/)
            expect(Object.keys(page1.body.data[0]).sort()).toEqual(
                ["createdAt", "email", "firstName", "id", "isLocked", "isVerified", "lastName", "phone", "role", "status"],
            )
        })

        it("searches by email, phone, first name, last name and full name, ignoring letter case", async () => {
            const { token } = await userWithToken("ADMIN")
            await createVerifiedUser({ firstName: "Noor", lastName: "Alam", email: "noor.alam@example.com", phone: "9811122233" })
            await createVerifiedUser({ firstName: "Priya", lastName: "Shah", email: "priya@example.com", phone: "9822233344" })

            const emails = async (search: string) =>
                (await api(app, token).get(`/admin/users?search=${encodeURIComponent(search)}`)).body.data.map((u: { email: string }) => u.email)

            expect(await emails("NOOR.ALAM")).toEqual(["noor.alam@example.com"])
            expect(await emails("9822")).toEqual(["priya@example.com"])
            expect(await emails("priy")).toEqual(["priya@example.com"])
            expect(await emails("shah")).toEqual(["priya@example.com"])
            expect(await emails("noor alam")).toEqual(["noor.alam@example.com"])
            expect(await emails("nobody-matches")).toEqual([])
        })

        it("treats % and _ in the search literally (they are not wildcards)", async () => {
            const { token } = await userWithToken("ADMIN")
            await createVerifiedUser({ email: "plain@example.com", firstName: "Plain" })
            await createVerifiedUser({ email: "a_b@example.com", firstName: "Under" })

            const total = async (search: string) =>
                (await api(app, token).get(`/admin/users?search=${encodeURIComponent(search)}`)).body.total

            expect(await total("%%")).toBe(0) // would match everyone if % were a wildcard
            expect(await total("a_")).toBe(1) // matches "a_b", not "plain"
            expect(await total("_b@")).toBe(1)
            expect(await total("p_ain")).toBe(0) // would match "plain" if _ were a wildcard
        })

        it("filters by role, status and verification, and combines filters", async () => {
            const { token } = await userWithToken("ADMIN")
            await createVerifiedUser({ email: "m@example.com", role: "MANAGER" })
            await createVerifiedUser({ email: "s@example.com", status: "SUSPENDED" })
            await createVerifiedUser({ email: "n@example.com", isVerified: false })

            const emails = async (q: string) => (await api(app, token).get(`/admin/users?${q}`)).body.data.map((u: { email: string }) => u.email)

            expect(await emails("role=MANAGER")).toEqual(["m@example.com"])
            expect(await emails("status=SUSPENDED")).toEqual(["s@example.com"])
            expect(await emails("isVerified=false")).toEqual(["n@example.com"])
            expect(await emails("role=USER&status=ACTIVE&isVerified=true")).toEqual([])
            expect(await emails("role=ADMIN")).toHaveLength(1)
        })

        it("flags accounts that are currently locked out", async () => {
            const { token } = await userWithToken("ADMIN")
            await createVerifiedUser({ email: "locked@example.com", lockedUntil: new Date(Date.now() + 600_000) })
            await createVerifiedUser({ email: "free@example.com", lockedUntil: new Date(Date.now() - 600_000) })

            const res = await api(app, token).get("/admin/users?role=USER")

            const byEmail = Object.fromEntries(res.body.data.map((u: { email: string; isLocked: boolean }) => [u.email, u.isLocked]))
            expect(byEmail).toEqual({ "locked@example.com": true, "free@example.com": false })
        })

        it.each(["page=0", "limit=51", "limit=abc", "search=a", "role=BOSS", "status=GONE", "isVerified=maybe"])("rejects %s with 400", async (query) => {
            const { token } = await userWithToken("ADMIN")
            expect((await api(app, token).get(`/admin/users?${query}`)).status).toBe(400)
        })
    })

    describe("GET /admin/users/:id", () => {
        it("shows one user with their booking count", async () => {
            const admin = await userWithToken("ADMIN")
            const { seat, slot, user, token } = await setupWorld()
            await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(2)] })

            const res = await api(app, admin.token).get(`/admin/users/${user.id}`)

            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: user.id, email: user.email, role: "USER", bookingCount: 1 })
            expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/)
        })

        it("404 for an unknown user, 400 for a malformed id", async () => {
            const { token } = await userWithToken("ADMIN")
            expect((await api(app, token).get("/admin/users/3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f")).status).toBe(404)
            expect((await api(app, token).get("/admin/users/1")).status).toBe(400)
            expect((await api(app, token).get("/admin/users/1' OR '1'='1")).status).toBe(400)
        })
    })

    describe("PATCH /admin/users/:id/status", () => {
        it("suspending a user ends their session at once: access token, refresh token and login", async () => {
            const admin = await userWithToken("ADMIN")
            const victim = await createVerifiedUser({ email: "victim@example.com" })
            const { accessToken, cookie } = await loginAs("victim@example.com")
            expect((await api(app, accessToken).get("/auth/me")).status).toBe(200)

            const res = await api(app, admin.token).patch(`/admin/users/${victim.id}/status`, { status: "SUSPENDED" })

            expect(res.status).toBe(200)
            expect(res.body.status).toBe("SUSPENDED")
            expect((await api(app, accessToken).get("/auth/me")).status).toBe(401)
            const refresh = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookieHeader(cookie))
            expect(refresh.status).toBe(401)
            expect((await loginAs("victim@example.com")).res.status).toBe(403)
            expect((await db.select().from(refreshTokensTable)).every((t) => t.revokedAt !== null)).toBe(true)
        })

        it("suspension revokes every refresh token immediately, and they stay dead after the user is reactivated", async () => {
            // Without the revocation, the old cookie would work again as soon as the user is reactivated.
            const admin = await userWithToken("ADMIN")
            const user = await createVerifiedUser({ email: "again@example.com" })
            const { cookie } = await loginAs("again@example.com")
            const second = await loginAs("again@example.com") // a second device

            await api(app, admin.token).patch(`/admin/users/${user.id}/status`, { status: "SUSPENDED" })

            // revoked by the suspension itself, before anyone tried to use them
            expect((await db.select().from(refreshTokensTable)).every((t) => t.revokedAt !== null)).toBe(true)

            await api(app, admin.token).patch(`/admin/users/${user.id}/status`, { status: "ACTIVE" })
            for (const old of [cookie, second.cookie]) {
                expect((await request(app).post("/api/v1/auth/refresh").set("Cookie", cookieHeader(old))).status).toBe(401)
            }
            expect((await loginAs("again@example.com")).res.status).toBe(200) // a fresh login works
        })

        it("reactivating restores access and also lifts a login lockout", async () => {
            const admin = await userWithToken("ADMIN")
            const user = await createVerifiedUser({
                email: "back@example.com", status: "SUSPENDED", failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 600_000),
            })

            const res = await api(app, admin.token).patch(`/admin/users/${user.id}/status`, { status: "ACTIVE" })

            expect(res.body).toMatchObject({ status: "ACTIVE", isLocked: false })
            expect((await getUser(user.id))).toMatchObject({ failedLoginAttempts: 0, lockedUntil: null })
            expect((await loginAs("back@example.com")).res.status).toBe(200)
        })

        it("writes an audit entry with the old and new status, and only when something changed", async () => {
            const admin = await userWithToken("ADMIN")
            const user = await createVerifiedUser()

            await api(app, admin.token).patch(`/admin/users/${user.id}/status`, { status: "SUSPENDED" })
            await api(app, admin.token).patch(`/admin/users/${user.id}/status`, { status: "SUSPENDED" }) // no change

            const entries = await audits()
            expect(entries).toHaveLength(1)
            expect(entries[0]).toMatchObject({
                actorId: admin.user.id, action: "USER_STATUS_CHANGED", targetType: "USER", targetId: user.id,
                before: { status: "ACTIVE" }, after: { status: "SUSPENDED" },
            })
        })

        it("keeps the suspended user's existing bookings (nothing is cancelled)", async () => {
            const admin = await userWithToken("ADMIN")
            const { seat, slot, user, token } = await setupWorld()
            const booking = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(2)] })

            await api(app, admin.token).patch(`/admin/users/${user.id}/status`, { status: "SUSPENDED" })

            const staff = await userWithToken("ADMIN")
            const view = await api(app, staff.token).get(`/bookings/${booking.body.id}`)
            expect(view.body.status).toBe("PENDING")
        })

        it("admin accounts cannot be suspended through the API (including by themselves)", async () => {
            const admin = await userWithToken("ADMIN")
            const other = await createVerifiedUser({ role: "ADMIN" })

            const self = await api(app, admin.token).patch(`/admin/users/${admin.user.id}/status`, { status: "SUSPENDED" })
            const peer = await api(app, admin.token).patch(`/admin/users/${other.id}/status`, { status: "SUSPENDED" })

            for (const res of [self, peer]) {
                expect(res.status).toBe(403)
                expect(res.body.code).toBe("ADMIN_PROTECTED")
            }
            expect((await getUser(admin.user.id)).status).toBe("ACTIVE")
            expect(await audits()).toHaveLength(0)
        })

        it("404 for an unknown user, 400 for a bad status", async () => {
            const { token, user } = await userWithToken("ADMIN")
            expect((await api(app, token).patch("/admin/users/3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f/status", { status: "ACTIVE" })).status).toBe(404)
            expect((await api(app, token).patch(`/admin/users/${user.id}/status`, { status: "DELETED" })).status).toBe(400)
        })
    })

    describe("PATCH /admin/users/:id/role", () => {
        it("promotes a verified user to MANAGER, who immediately gets staff access", async () => {
            const admin = await userWithToken("ADMIN")
            const person = await userWithToken("USER", { email: "future.manager@example.com" })
            const { seat, slot, token: customerToken } = await setupWorld()
            const booking = await postBooking(app, customerToken, { seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(2)] })
            expect((await api(app, person.token).get(`/bookings/${booking.body.id}`)).status).toBe(404) // not staff yet

            const res = await api(app, admin.token).patch(`/admin/users/${person.user.id}/role`, { role: "MANAGER" })

            expect(res.status).toBe(200)
            expect(res.body.role).toBe("MANAGER")
            const asManager = await api(app, person.token).get(`/bookings/${booking.body.id}`) // same token, no re-login
            expect(asManager.status).toBe(200)
            expect(asManager.body.customer).toBeDefined()
            expect((await audits())[0]).toMatchObject({ action: "USER_ROLE_CHANGED", before: { role: "USER" }, after: { role: "MANAGER" } })
        })

        it("demotes a manager back to USER, who immediately loses staff access", async () => {
            const admin = await userWithToken("ADMIN")
            const manager = await userWithToken("MANAGER")
            const { seat, slot, token: customerToken } = await setupWorld()
            const booking = await postBooking(app, customerToken, { seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(2)] })
            expect((await api(app, manager.token).get(`/bookings/${booking.body.id}`)).status).toBe(200)

            await api(app, admin.token).patch(`/admin/users/${manager.user.id}/role`, { role: "USER" })

            expect((await api(app, manager.token).get(`/bookings/${booking.body.id}`)).status).toBe(404)
        })

        it("an admin can never be created through the API", async () => {
            const admin = await userWithToken("ADMIN")
            const person = await createVerifiedUser()

            const res = await api(app, admin.token).patch(`/admin/users/${person.id}/role`, { role: "ADMIN" })

            expect(res.status).toBe(400)
            expect((await getUser(person.id)).role).toBe("USER")
        })

        it("an existing admin cannot be demoted through the API", async () => {
            const admin = await userWithToken("ADMIN")
            const other = await createVerifiedUser({ role: "ADMIN" })

            for (const id of [other.id, admin.user.id]) {
                const res = await api(app, admin.token).patch(`/admin/users/${id}/role`, { role: "USER" })
                expect(res.status).toBe(403)
                expect(res.body.code).toBe("ADMIN_PROTECTED")
            }
            expect((await getUser(other.id)).role).toBe("ADMIN")
        })

        it("only a verified, active user can become a manager", async () => {
            const admin = await userWithToken("ADMIN")
            const unverified = await createVerifiedUser({ isVerified: false })
            const suspended = await createVerifiedUser({ status: "SUSPENDED" })

            const a = await api(app, admin.token).patch(`/admin/users/${unverified.id}/role`, { role: "MANAGER" })
            const b = await api(app, admin.token).patch(`/admin/users/${suspended.id}/role`, { role: "MANAGER" })

            expect(a.body.code).toBe("USER_NOT_VERIFIED")
            expect(b.body.code).toBe("USER_SUSPENDED")
            expect((await getUser(unverified.id)).role).toBe("USER")
            expect(await audits()).toHaveLength(0)
        })

        it("setting the role a user already has changes nothing and is not logged", async () => {
            const admin = await userWithToken("ADMIN")
            const user = await createVerifiedUser()
            const res = await api(app, admin.token).patch(`/admin/users/${user.id}/role`, { role: "USER" })
            expect(res.status).toBe(200)
            expect(await audits()).toHaveLength(0)
        })

        it("404 for an unknown user, 400 for a missing or unknown role", async () => {
            const { token } = await userWithToken("ADMIN")
            const target = await createVerifiedUser()
            expect((await api(app, token).patch("/admin/users/3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f/role", { role: "USER" })).status).toBe(404)
            expect((await api(app, token).patch(`/admin/users/${target.id}/role`, {})).status).toBe(400)
            expect((await api(app, token).patch(`/admin/users/${target.id}/role`, { role: "SUPERUSER" })).status).toBe(400)
        })
    })

    it("a manager cannot use any of these endpoints to promote themselves", async () => {
        const manager = await userWithToken("MANAGER")
        const res = await api(app, manager.token).patch(`/admin/users/${manager.user.id}/role`, { role: "USER" })
        expect(res.status).toBe(403)
    })
})
