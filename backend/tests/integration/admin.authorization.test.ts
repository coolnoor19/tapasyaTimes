import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../../src/app.js"
import { router as adminRouter } from "../../src/routes/admin.routes.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { api, userWithToken } from "../helpers/admin.js"

const app = createApp()
const ID = "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"

// EVERY admin route. If someone adds a route to admin.routes.ts, the completeness test below
// fails until it is listed here, so it gets covered by the access-control matrix as well.
const ADMIN_ROUTES: [method: "get" | "post" | "patch" | "put", path: string][] = [
    ["get", "/admin/seats"],
    ["post", "/admin/seats"],
    ["patch", `/admin/seats/${ID}`],
    ["get", "/admin/time-slots"],
    ["post", "/admin/time-slots"],
    ["patch", `/admin/time-slots/${ID}`],
    ["get", "/admin/seat-prices"],
    ["put", "/admin/seat-prices/STUDY"],
    ["get", "/admin/users"],
    ["get", `/admin/users/${ID}`],
    ["patch", `/admin/users/${ID}/status`],
    ["patch", `/admin/users/${ID}/role`],
    ["get", "/admin/audit-logs"],
]

type Layer = { route?: unknown }
const stack = (adminRouter as unknown as { stack: Layer[] }).stack

describe("admin route table", () => {
    it("lists every route registered in admin.routes.ts (so none escapes the matrix)", () => {
        const registered = stack.filter((layer) => layer.route).length
        expect(registered).toBe(ADMIN_ROUTES.length)
    })

    it("registers the authentication + admin-only gate BEFORE any route", () => {
        const firstRoute = stack.findIndex((layer) => layer.route)
        expect(firstRoute).toBeGreaterThanOrEqual(2) // authenticate, authorize("ADMIN")
    })
})

describe.skipIf(!hasTestDb)("admin access control (every route x every kind of caller)", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it.each(ADMIN_ROUTES)("%s %s  ->  401 for anonymous callers, even with an invalid body", async (method, path) => {
        const res = await api(app)[method](path, { garbage: true })
        expect(res.status).toBe(401)
    })

    it.each(ADMIN_ROUTES)("%s %s  ->  403 for a USER", async (method, path) => {
        const { token } = await userWithToken("USER")
        expect((await api(app, token)[method](path, {})).status).toBe(403)
    })

    it.each(ADMIN_ROUTES)("%s %s  ->  403 for a MANAGER (a manager is not an admin)", async (method, path) => {
        const { token } = await userWithToken("MANAGER")
        expect((await api(app, token)[method](path, {})).status).toBe(403)
    })

    it.each(ADMIN_ROUTES)("%s %s  ->  reachable by an ADMIN (never 401 or 403)", async (method, path) => {
        const { token } = await userWithToken("ADMIN")
        const status = (await api(app, token)[method](path, {})).status
        expect([401, 403]).not.toContain(status)
    })

    it("a suspended admin is locked out at once", async () => {
        const { token, user } = await userWithToken("ADMIN")
        const { db } = await import("../../src/db/index.js")
        const { usersTable } = await import("../../src/db/schema.js")
        const { eq } = await import("drizzle-orm")
        await db.update(usersTable).set({ status: "SUSPENDED" }).where(eq(usersTable.id, user.id))

        expect((await api(app, token).get("/admin/seats")).status).toBe(401)
    })

    it("a user who was demoted from admin loses access immediately, without waiting for the token to expire", async () => {
        const { token, user } = await userWithToken("ADMIN")
        expect((await api(app, token).get("/admin/seats")).status).toBe(200)

        const { db } = await import("../../src/db/index.js")
        const { usersTable } = await import("../../src/db/schema.js")
        const { eq } = await import("drizzle-orm")
        await db.update(usersTable).set({ role: "USER" }).where(eq(usersTable.id, user.id))

        expect((await api(app, token).get("/admin/seats")).status).toBe(403)
    })
})
