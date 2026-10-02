import { afterAll, beforeEach, describe, expect, it } from "vitest"
import express from "express"
import request from "supertest"
import { authenticate } from "../../src/middlewares/authenticate.js"
import { authorize } from "../../src/middlewares/authorize.js"
import { errorHandler } from "../../src/middlewares/errorHandler.js"
import { signAccessToken } from "../../src/utils/token.util.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"

// The real admin/manager features do not exist yet, so the middleware is tested on a
// small app with two protected routes. This is the pattern every future route will use.
const app = express()
app.get("/admin-only", authenticate, authorize("ADMIN"), (_req, res) => void res.json({ ok: true }))
app.get("/staff", authenticate, authorize("ADMIN", "MANAGER"), (_req, res) => void res.json({ ok: true }))
app.get("/any-user", authenticate, (req, res) => void res.json({ role: req.user!.role }))
app.use(errorHandler)

async function as(role: "ADMIN" | "MANAGER" | "USER", path: string) {
    const user = await createVerifiedUser({ role })
    return request(app).get(path).set("Authorization", `Bearer ${await signAccessToken(user.id)}`)
}

describe.skipIf(!hasTestDb)("role-based authorization", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("rejects anonymous requests with 401 on every protected route", async () => {
        for (const path of ["/admin-only", "/staff", "/any-user"]) {
            expect((await request(app).get(path)).status).toBe(401)
        }
    })

    describe("admin-only route", () => {
        it("admits ADMIN", async () => expect((await as("ADMIN", "/admin-only")).status).toBe(200))
        it("refuses MANAGER (a manager is not an admin)", async () => expect((await as("MANAGER", "/admin-only")).status).toBe(403))
        it("refuses USER", async () => {
            const res = await as("USER", "/admin-only")
            expect(res.status).toBe(403)
            expect(res.body.code).toBe("FORBIDDEN")
        })
    })

    describe("staff route (ADMIN or MANAGER)", () => {
        it("admits ADMIN", async () => expect((await as("ADMIN", "/staff")).status).toBe(200))
        it("admits MANAGER", async () => expect((await as("MANAGER", "/staff")).status).toBe(200))
        it("refuses USER", async () => expect((await as("USER", "/staff")).status).toBe(403))
    })

    it("any logged-in user can reach a route with no role restriction", async () => {
        expect((await as("USER", "/any-user")).body).toEqual({ role: "USER" })
    })

    it("a USER cannot become admin by putting a role in the request", async () => {
        const user = await createVerifiedUser({ role: "USER" })
        const res = await request(app)
            .get("/admin-only?role=ADMIN")
            .set("Authorization", `Bearer ${await signAccessToken(user.id)}`)
            .set("X-Role", "ADMIN")
        expect(res.status).toBe(403)
    })
})
