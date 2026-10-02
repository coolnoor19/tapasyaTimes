import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { usersTable } from "../../src/db/schema.js"
import { router as managerRouter } from "../../src/routes/manager.routes.js"
import { api, userWithToken } from "../helpers/admin.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"

const app = createApp()
const ID = "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"

// EVERY manager route. A new route in manager.routes.ts fails the completeness test below until it
// is listed here, so it is automatically covered by the access-control matrix as well.
const MANAGER_ROUTES = [
    "/manager/board",
    "/manager/occupancy",
    "/manager/bookings",
    `/manager/bookings/${ID}`,
    "/manager/customers",
    `/manager/customers/${ID}`,
]

type Layer = { route?: { methods: Record<string, boolean> } }
const stack = (managerRouter as unknown as { stack: Layer[] }).stack

describe("manager route table", () => {
    it("lists every route registered in manager.routes.ts (so none escapes the matrix)", () => {
        expect(stack.filter((layer) => layer.route).length).toBe(MANAGER_ROUTES.length)
    })

    it("registers the authentication + role gate BEFORE any route", () => {
        expect(stack.findIndex((layer) => layer.route)).toBeGreaterThanOrEqual(2) // authenticate, authorize(...)
    })

    it("is read-only: every registered route is a GET", () => {
        const methods = stack.filter((layer) => layer.route).flatMap((layer) => Object.keys(layer.route!.methods))
        expect(new Set(methods)).toEqual(new Set(["get"]))
    })
})

describe.skipIf(!hasTestDb)("manager access control (every route x every kind of caller)", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it.each(MANAGER_ROUTES)("GET %s  ->  401 for anonymous callers", async (path) => {
        expect((await api(app).get(path)).status).toBe(401)
    })

    it.each(MANAGER_ROUTES)("GET %s  ->  403 for a customer (USER)", async (path) => {
        const { token } = await userWithToken("USER")
        expect((await api(app, token).get(path)).status).toBe(403)
    })

    it.each(MANAGER_ROUTES)("GET %s  ->  reachable by a MANAGER (never 401 or 403)", async (path) => {
        const { token } = await userWithToken("MANAGER")
        expect([401, 403]).not.toContain((await api(app, token).get(path)).status)
    })

    it.each(MANAGER_ROUTES)("GET %s  ->  reachable by an ADMIN (never 401 or 403)", async (path) => {
        const { token } = await userWithToken("ADMIN")
        expect([401, 403]).not.toContain((await api(app, token).get(path)).status)
    })

    it.each(["post", "patch", "put"] as const)(
        "a MANAGER cannot change anything: %s on a manager path is not an endpoint (404)",
        async (method) => {
            const { token } = await userWithToken("MANAGER")
            for (const path of MANAGER_ROUTES) {
                expect((await api(app, token)[method](path, {})).status, `${method} ${path}`).toBe(404)
            }
        },
    )

    it("a customer is refused before the request is even validated (403, not 400)", async () => {
        const { token } = await userWithToken("USER")
        expect((await api(app, token).get("/manager/board?date=garbage")).status).toBe(403)
    })

    it("a suspended manager is locked out at once", async () => {
        const { token, user } = await userWithToken("MANAGER")
        expect((await api(app, token).get("/manager/board")).status).toBe(200)
        await db.update(usersTable).set({ status: "SUSPENDED" }).where(eq(usersTable.id, user.id))
        expect((await api(app, token).get("/manager/board")).status).toBe(401)
    })

    it("a manager who is demoted loses access immediately, without waiting for the token to expire", async () => {
        const { token, user } = await userWithToken("MANAGER")
        expect((await api(app, token).get("/manager/board")).status).toBe(200)
        await db.update(usersTable).set({ role: "USER" }).where(eq(usersTable.id, user.id))
        expect((await api(app, token).get("/manager/board")).status).toBe(403)
    })

    it("every manager response is marked no-store (customer data must not be cached)", async () => {
        const { token } = await userWithToken("MANAGER")
        for (const path of ["/manager/board", "/manager/occupancy", "/manager/bookings", "/manager/customers"]) {
            expect((await api(app, token).get(path)).headers["cache-control"], path).toBe("no-store")
        }
    })
})
