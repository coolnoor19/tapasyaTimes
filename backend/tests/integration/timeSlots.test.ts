import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { createApp } from "../../src/app.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { tokenFor } from "../helpers/booking.js"
import { createTimeSlot } from "../helpers/factories.js"

const app = createApp()

const get = (path: string, token?: string) => {
    const req = request(app).get(`/api/v1${path}`)
    return token === undefined ? req : req.set("Authorization", `Bearer ${token}`)
}

describe.skipIf(!hasTestDb)("GET /time-slots", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("requires login", async () => {
        expect((await get("/time-slots")).status).toBe(401)
    })

    it("lists active slots earliest first, with HH:MM times", async () => {
        await createTimeSlot({ startTime: "11:00", endTime: "12:00", displayName: "11:00 - 12:00" })
        await createTimeSlot({ startTime: "09:00", endTime: "10:00", displayName: "09:00 - 10:00" })
        await createTimeSlot({ startTime: "10:00", endTime: "11:00", displayName: "10:00 - 11:00" })
        const token = await tokenFor((await createVerifiedUser()).id)

        const res = await get("/time-slots", token)

        expect(res.status).toBe(200)
        expect(res.body.timeSlots.map((s: { displayName: string }) => s.displayName)).toEqual([
            "09:00 - 10:00",
            "10:00 - 11:00",
            "11:00 - 12:00",
        ])
        expect(res.body.timeSlots[0]).toEqual({
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            displayName: "09:00 - 10:00",
            startTime: "09:00",
            endTime: "10:00",
        })
    })

    it("hides inactive slots", async () => {
        await createTimeSlot({ displayName: "open" })
        await createTimeSlot({ startTime: "12:00", endTime: "13:00", displayName: "closed", isActive: false })
        const token = await tokenFor((await createVerifiedUser()).id)

        const res = await get("/time-slots", token)

        expect(res.body.timeSlots.map((s: { displayName: string }) => s.displayName)).toEqual(["open"])
    })

    it("returns an empty list when there are no slots", async () => {
        const token = await tokenFor((await createVerifiedUser()).id)
        expect((await get("/time-slots", token)).body).toEqual({ timeSlots: [] })
    })
})
