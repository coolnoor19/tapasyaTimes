import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../../src/app.js"
import { getBusinessNow } from "../../src/utils/businessTime.js"
import { api, userWithToken } from "../helpers/admin.js"
import { futureDate, occupy } from "../helpers/booking.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createSeat, createTimeSlot } from "../helpers/factories.js"

const app = createApp()
const [D1, D2, D3] = [2, 3, 4].map(futureDate) as [string, string, string]

async function occupancy(query = "") {
    const { token } = await userWithToken("MANAGER")
    return api(app, token).get(`/manager/occupancy${query}`)
}
const range = (from: string, to: string) => `?from=${from}&to=${to}`
type Day = { date: string; capacity: number; booked: number; occupancyPercent: number; bySeatType: Record<string, { capacity: number; booked: number; occupancyPercent: number }> }

// 2 EXECUTIVE + 2 STUDY seats, 2 active slots  ->  capacity 8 units per day
async function standardWorld() {
    const slots = [await createTimeSlot({ startTime: "09:00", endTime: "10:00" }), await createTimeSlot({ startTime: "10:00", endTime: "11:00" })] as const
    const seats = [
        await createSeat({ seatNumber: "E1", seatType: "EXECUTIVE" }),
        await createSeat({ seatNumber: "E2", seatType: "EXECUTIVE" }),
        await createSeat({ seatNumber: "S1", seatType: "STUDY" }),
        await createSeat({ seatNumber: "S2", seatType: "STUDY" }),
    ] as const
    return { slots, seats }
}

describe.skipIf(!hasTestDb)("GET /manager/occupancy", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("defaults to the 7 days starting today (India time)", async () => {
        const res = await occupancy()
        const today = getBusinessNow().date
        expect(res.status).toBe(200)
        expect(res.body.from).toBe(today)
        expect(res.body.days).toHaveLength(7)
        expect(res.body.to).toBe(res.body.days[6].date)
        expect(res.body.days[0].date).toBe(today)
    })

    it("lists every day of the range, with zero for days that have no bookings", async () => {
        await standardWorld()
        const res = await occupancy(range(D1, D3))

        expect(res.body.days.map((d: Day) => d.date)).toEqual([D1, D2, D3])
        expect(res.body.days.every((d: Day) => d.booked === 0 && d.occupancyPercent === 0 && d.capacity === 8)).toBe(true)
    })

    it("counts units as seats in service x active slots, and splits by seat type", async () => {
        const { slots, seats } = await standardWorld()
        await occupy({ seatId: seats[0].id, slotId: slots[0].id, dates: [D1, D2] }) // E1 slot 1 on D1 and D2
        await occupy({ seatId: seats[0].id, slotId: slots[1].id, dates: [D1] }) // E1 slot 2 on D1
        await occupy({ seatId: seats[2].id, slotId: slots[0].id, dates: [D1] }) // S1 slot 1 on D1

        const res = await occupancy(range(D1, D2))
        const [d1, d2] = res.body.days as Day[]

        expect(d1).toMatchObject({ capacity: 8, booked: 3, occupancyPercent: 37.5 })
        expect(d1!.bySeatType.EXECUTIVE).toEqual({ capacity: 4, booked: 2, occupancyPercent: 50 })
        expect(d1!.bySeatType.STUDY).toEqual({ capacity: 4, booked: 1, occupancyPercent: 25 })
        expect(d1!.bySeatType.PROFESSIONAL).toEqual({ capacity: 0, booked: 0, occupancyPercent: 0 }) // no such seats: 0, never NaN
        expect(d2).toMatchObject({ booked: 1, occupancyPercent: 12.5 })
        expect(res.body.summary).toEqual({ capacity: 16, booked: 4, occupancyPercent: 25 })
        expect(res.body.activeTimeSlots).toBe(2)
    })

    it("a fully booked day is exactly 100%", async () => {
        const { slots, seats } = await standardWorld()
        for (const seat of seats) for (const slot of slots) await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

        const [day] = (await occupancy(range(D1, D1))).body.days as Day[]

        expect(day).toMatchObject({ capacity: 8, booked: 8, occupancyPercent: 100 })
    })

    it("does not count expired holds or released items", async () => {
        const { slots, seats } = await standardWorld()
        const past = new Date(Date.now() - 60_000)
        await occupy({ seatId: seats[0].id, slotId: slots[0].id, dates: [D1], itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: past })
        await occupy({ seatId: seats[1].id, slotId: slots[0].id, dates: [D1], itemStatus: "RELEASED", bookingStatus: "EXPIRED" })
        // a live hold DOES count
        await occupy({
            seatId: seats[2].id,
            slotId: slots[0].id,
            dates: [D1],
            itemStatus: "HELD",
            bookingStatus: "PENDING",
            expiresAt: new Date(Date.now() + 5 * 60_000),
        })

        const [day] = (await occupancy(range(D1, D1))).body.days as Day[]

        expect(day!.booked).toBe(1)
    })

    it("leaves out-of-service seats and inactive slots from BOTH capacity and bookings (so it can never exceed 100%)", async () => {
        const { slots, seats } = await standardWorld()
        const broken = await createSeat({ seatNumber: "M1", seatType: "EXECUTIVE", status: "MAINTENANCE" })
        const off = await createTimeSlot({ startTime: "20:00", endTime: "21:00", isActive: false })
        await occupy({ seatId: broken.id, slotId: slots[0].id, dates: [D1] })
        await occupy({ seatId: seats[0].id, slotId: off.id, dates: [D1] })

        const [day] = (await occupancy(range(D1, D1))).body.days as Day[]

        expect(day).toMatchObject({ capacity: 8, booked: 0 })
    })

    it("with no seats or no slots the percentage is 0 (no division by zero)", async () => {
        const res = await occupancy(range(D1, D2))
        expect(res.status).toBe(200)
        expect(res.body.summary).toEqual({ capacity: 0, booked: 0, occupancyPercent: 0 })
    })

    it("works across a month and a year boundary", async () => {
        await standardWorld()
        const res = await occupancy(range("2026-12-30", "2027-01-02"))
        expect(res.body.days.map((d: Day) => d.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"])
    })

    it("accepts exactly 31 days and a single day", async () => {
        expect((await occupancy(range("2026-08-01", "2026-08-31"))).body.days).toHaveLength(31)
        expect((await occupancy(range(D1, D1))).body.days).toHaveLength(1)
    })

    it.each([
        ["32 days", range("2026-08-01", "2026-09-01")],
        ["to before from", range("2026-08-02", "2026-08-01")],
        ["a fake date", range("2026-02-30", "2026-03-02")],
        ["a malformed date", "?from=today"],
    ])("rejects %s with 400", async (_name, query) => {
        expect((await occupancy(query)).status).toBe(400)
    })

    it("a lone `to` before today is rejected rather than producing a negative range", async () => {
        // from defaults to today; to in the past makes to < from.
        const res = await occupancy("?to=2020-01-01")
        expect(res.status).toBe(400)
    })

    it("a lone `to` far in the future is rejected too (the range from today would exceed 31 days)", async () => {
        expect((await occupancy("?to=2099-01-01")).status).toBe(400)
    })

    it("a lone `from` far in the past still gives the default week from that day", async () => {
        const res = await occupancy("?from=2020-01-01")
        expect(res.body.days.map((d: Day) => d.date)[6]).toBe("2020-01-07")
    })
})
