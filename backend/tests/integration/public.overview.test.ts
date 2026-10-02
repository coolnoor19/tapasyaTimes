import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { seatPricesTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createSeat, createTimeSlot } from "../helpers/factories.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { futureDate, occupy } from "../helpers/booking.js"

const app = createApp()
const get = () => request(app).get("/api/v1/public/overview")

type Tier = { seatType: string; pricePerHourPaise: number | null; seatCount: number }
const tiersOf = (body: { tiers: Tier[] }) => Object.fromEntries(body.tiers.map((t) => [t.seatType, t]))

describe.skipIf(!hasTestDb)("GET /public/overview (no login)", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("works without any login", async () => {
        const res = await get()
        expect(res.status).toBe(200)
    })

    it("on an empty system lists all three tiers (no price, no seats) in a fixed order, and no time slots", async () => {
        const res = await get()
        expect(res.body).toEqual({
            currency: "INR",
            tiers: [
                { seatType: "EXECUTIVE", pricePerHourPaise: null, seatCount: 0 },
                { seatType: "PROFESSIONAL", pricePerHourPaise: null, seatCount: 0 },
                { seatType: "STUDY", pricePerHourPaise: null, seatCount: 0 },
            ],
            timeSlots: [],
        })
    })

    it("shows the prices admins set, in paise, and null for a tier that has none", async () => {
        await db.insert(seatPricesTable).values([
            { seatType: "EXECUTIVE", pricePerHourPaise: 15000 },
            { seatType: "STUDY", pricePerHourPaise: 6000 },
        ])
        const tiers = tiersOf((await get()).body)
        expect(tiers.EXECUTIVE!.pricePerHourPaise).toBe(15000)
        expect(tiers.STUDY!.pricePerHourPaise).toBe(6000)
        expect(tiers.PROFESSIONAL!.pricePerHourPaise).toBeNull()
    })

    it("a price change shows up on the next request (nothing is cached inside the server)", async () => {
        await db.insert(seatPricesTable).values({ seatType: "EXECUTIVE", pricePerHourPaise: 15000 })
        expect(tiersOf((await get()).body).EXECUTIVE!.pricePerHourPaise).toBe(15000)

        await db.update(seatPricesTable).set({ pricePerHourPaise: 18000 })
        expect(tiersOf((await get()).body).EXECUTIVE!.pricePerHourPaise).toBe(18000)
    })

    it("counts only seats that are in service, per tier", async () => {
        await createSeat({ seatNumber: "E1", seatType: "EXECUTIVE" })
        await createSeat({ seatNumber: "E2", seatType: "EXECUTIVE" })
        await createSeat({ seatNumber: "E3", seatType: "EXECUTIVE", status: "MAINTENANCE" })
        await createSeat({ seatNumber: "E4", seatType: "EXECUTIVE", status: "INACTIVE" })
        await createSeat({ seatNumber: "S1", seatType: "STUDY" })

        const tiers = tiersOf((await get()).body)

        expect(tiers.EXECUTIVE!.seatCount).toBe(2)
        expect(tiers.STUDY!.seatCount).toBe(1)
        expect(tiers.PROFESSIONAL!.seatCount).toBe(0)
    })

    it("lists active time slots earliest first, as HH:MM, and leaves out switched-off slots", async () => {
        await createTimeSlot({ startTime: "14:00", endTime: "15:00", displayName: "14:00 - 15:00" })
        await createTimeSlot({ startTime: "09:00", endTime: "10:00", displayName: "09:00 - 10:00" })
        await createTimeSlot({ startTime: "11:00", endTime: "12:00", displayName: "11:00 - 12:00", isActive: false })

        const { timeSlots } = (await get()).body

        expect(timeSlots).toEqual([
            { displayName: "09:00 - 10:00", startTime: "09:00", endTime: "10:00" },
            { displayName: "14:00 - 15:00", startTime: "14:00", endTime: "15:00" },
        ])
    })

    it("may be cached by browsers for a minute (it is public and changes rarely)", async () => {
        expect((await get()).headers["cache-control"]).toBe("public, max-age=60")
    })

    it("reveals nothing about people, bookings or internal ids", async () => {
        const slot = await createTimeSlot({ displayName: "10:00 - 11:00" })
        const seat = await createSeat({ seatNumber: "SECRET-1" })
        const customer = await createVerifiedUser({ firstName: "Privatename", email: "private@example.com" })
        await occupy({ seatId: seat.id, slotId: slot.id, dates: [futureDate(2)], userId: customer.id })

        const res = await get()
        const text = JSON.stringify(res.body)

        expect(text).not.toMatch(/Privatename|private@example|SECRET-1|[0-9a-f]{8}-[0-9a-f]{4}-/)
        // exactly these keys and no others
        expect(Object.keys(res.body).sort()).toEqual(["currency", "tiers", "timeSlots"])
        expect(Object.keys(res.body.tiers[0]).sort()).toEqual(["pricePerHourPaise", "seatCount", "seatType"])
        expect(Object.keys(res.body.timeSlots[0]).sort()).toEqual(["displayName", "endTime", "startTime"])
    })

    it("is read-only: other methods are not endpoints", async () => {
        for (const method of ["post", "put", "patch", "delete"] as const) {
            const res = await request(app)[method]("/api/v1/public/overview").send({})
            expect(res.status, method).toBe(404)
        }
    })

    it("only GET /overview exists under /public (no other public door was opened by accident)", async () => {
        for (const path of ["/api/v1/public", "/api/v1/public/users", "/api/v1/public/seats", "/api/v1/public/bookings"]) {
            expect((await request(app).get(path)).status, path).toBe(404)
        }
    })
})
