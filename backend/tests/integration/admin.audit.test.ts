import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../../src/app.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { api, userWithToken } from "../helpers/admin.js"
import { createSeat } from "../helpers/factories.js"

const app = createApp()

describe.skipIf(!hasTestDb)("admin: audit log", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("is empty at the start", async () => {
        const { token } = await userWithToken("ADMIN")
        expect((await api(app, token).get("/admin/audit-logs")).body).toEqual({ data: [], page: 1, limit: 20, total: 0 })
    })

    it("lists changes newest first, naming who made each one", async () => {
        const { token, user } = await userWithToken("ADMIN", { firstName: "Asha", lastName: "Rao", email: "asha@example.com" })
        await api(app, token).post("/admin/seats", { seatNumber: "A1", seatType: "STUDY", floor: 1 })
        await api(app, token).put("/admin/seat-prices/STUDY", { pricePerHourPaise: 6000 })

        const res = await api(app, token).get("/admin/audit-logs")

        expect(res.body.total).toBe(2)
        expect(res.body.data.map((e: { action: string }) => e.action)).toEqual(["PRICE_UPDATED", "SEAT_CREATED"])
        expect(res.body.data[0].actor).toEqual({ id: user.id, name: "Asha Rao", email: "asha@example.com" })
        expect(res.body.data[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it("records every kind of admin change", async () => {
        const { token } = await userWithToken("ADMIN")
        const target = await createVerifiedUser()
        const seat = await createSeat({ seatNumber: "A1" })

        await api(app, token).post("/admin/seats", { seatNumber: "B1", seatType: "STUDY", floor: 1 })
        await api(app, token).patch(`/admin/seats/${seat.id}`, { floor: 4 })
        const slot = await api(app, token).post("/admin/time-slots", { startTime: "09:00", endTime: "10:00" })
        await api(app, token).patch(`/admin/time-slots/${slot.body.id}`, { displayName: "Early" })
        await api(app, token).put("/admin/seat-prices/STUDY", { pricePerHourPaise: 6000 })
        await api(app, token).patch(`/admin/users/${target.id}/status`, { status: "SUSPENDED" })
        await api(app, token).patch(`/admin/users/${target.id}/status`, { status: "ACTIVE" })
        await api(app, token).patch(`/admin/users/${target.id}/role`, { role: "MANAGER" })

        const actions = (await api(app, token).get("/admin/audit-logs?limit=50")).body.data.map((e: { action: string }) => e.action).reverse()
        expect(actions).toEqual([
            "SEAT_CREATED", "SEAT_UPDATED", "SLOT_CREATED", "SLOT_UPDATED", "PRICE_UPDATED",
            "USER_STATUS_CHANGED", "USER_STATUS_CHANGED", "USER_ROLE_CHANGED",
        ])
    })

    it("filters by action, target and actor", async () => {
        const a = await userWithToken("ADMIN")
        const b = await userWithToken("ADMIN")
        const seat = await api(app, a.token).post("/admin/seats", { seatNumber: "A1", seatType: "STUDY", floor: 1 })
        await api(app, b.token).put("/admin/seat-prices/STUDY", { pricePerHourPaise: 6000 })

        const count = async (q: string) => (await api(app, a.token).get(`/admin/audit-logs?${q}`)).body.total

        expect(await count("action=SEAT_CREATED")).toBe(1)
        expect(await count("targetType=SEAT_PRICE")).toBe(1)
        expect(await count(`targetId=${seat.body.id}`)).toBe(1)
        expect(await count(`actorId=${b.user.id}`)).toBe(1)
        expect(await count(`actorId=${a.user.id}&action=PRICE_UPDATED`)).toBe(0)
        expect((await api(app, a.token).get("/admin/audit-logs?actorId=not-an-id")).status).toBe(400)
    })

    it("paginates without repeating or skipping entries", async () => {
        const { token } = await userWithToken("ADMIN")
        for (let i = 1; i <= 5; i++) await api(app, token).post("/admin/seats", { seatNumber: `S${i}`, seatType: "STUDY", floor: 1 })

        const p1 = await api(app, token).get("/admin/audit-logs?limit=2&page=1")
        const p2 = await api(app, token).get("/admin/audit-logs?limit=2&page=2")
        const p3 = await api(app, token).get("/admin/audit-logs?limit=2&page=3")

        expect([p1.body.data.length, p2.body.data.length, p3.body.data.length]).toEqual([2, 2, 1])
        expect(p1.body.total).toBe(5)
        const ids = [...p1.body.data, ...p2.body.data, ...p3.body.data].map((e: { id: string }) => e.id)
        expect(new Set(ids).size).toBe(5)
    })

    it("never contains passwords, tokens or other secrets", async () => {
        const { token } = await userWithToken("ADMIN")
        const target = await createVerifiedUser()
        await api(app, token).patch(`/admin/users/${target.id}/status`, { status: "SUSPENDED" })
        await api(app, token).patch(`/admin/users/${target.id}/role`, { role: "MANAGER" })

        const body = JSON.stringify((await api(app, token).get("/admin/audit-logs")).body)

        expect(body).not.toMatch(/passwordHash|password_hash|\$2[aby]\$|tokenHash|refresh|secret/i)
    })

    it("a refused change leaves no audit entry", async () => {
        const { token } = await userWithToken("ADMIN")
        await createSeat({ seatNumber: "A1" })
        await api(app, token).post("/admin/seats", { seatNumber: "A1", seatType: "STUDY", floor: 1 }) // duplicate: refused
        await api(app, token).post("/admin/seats", { seatNumber: "", seatType: "STUDY", floor: 1 }) // invalid: refused

        expect((await api(app, token).get("/admin/audit-logs")).body.total).toBe(0)
    })

    it("rejects limits above 50", async () => {
        const { token } = await userWithToken("ADMIN")
        expect((await api(app, token).get("/admin/audit-logs?limit=51")).status).toBe(400)
    })
})
