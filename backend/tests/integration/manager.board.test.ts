import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createApp } from "../../src/app.js"
import { getBusinessNow } from "../../src/utils/businessTime.js"
import { api, userWithToken } from "../helpers/admin.js"
import { futureDate, occupy } from "../helpers/booking.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createSeat, createTimeSlot } from "../helpers/factories.js"
import { createVerifiedUser } from "../helpers/auth.js"

const app = createApp()
const D1 = futureDate(2)
const D2 = futureDate(3)

type BoardSeat = { seatNumber: string; state: string; booking: null | Record<string, any> }
type BoardSlot = { timeSlot: { id: string; displayName: string; isActive: boolean }; summary: Record<string, number>; seats: BoardSeat[] }

async function board(query = "") {
    const { token } = await userWithToken("MANAGER")
    return api(app, token).get(`/manager/board${query}`)
}
const seatsOf = (slot: BoardSlot | undefined) => Object.fromEntries((slot?.seats ?? []).map((seat) => [seat.seatNumber, seat]))

describe.skipIf(!hasTestDb)("GET /manager/board", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("defaults to today in India time", async () => {
        const res = await board()
        expect(res.status).toBe(200)
        expect(res.body.date).toBe(getBusinessNow().date)
        expect(res.body.isToday).toBe(true)
        expect(res.body.slots).toEqual([])
    })

    it("shows every seat of every active slot, ordered by time, with who holds each booked seat", async () => {
        const late = await createTimeSlot({ startTime: "14:00", endTime: "15:00", displayName: "late" })
        const early = await createTimeSlot({ startTime: "09:00", endTime: "10:00", displayName: "early" })
        const a1 = await createSeat({ seatNumber: "A1" })
        await createSeat({ seatNumber: "A2" })
        const customer = await createVerifiedUser({ firstName: "Asha", lastName: "Rao", phone: "9876543210" })
        const booking = await occupy({ seatId: a1.id, slotId: early.id, dates: [D1], userId: customer.id })

        const res = await board(`?date=${D1}`)

        expect(res.body.date).toBe(D1)
        expect(res.body.isToday).toBe(false)
        expect(res.body.slots.map((s: BoardSlot) => s.timeSlot.displayName)).toEqual(["early", "late"])
        const [earlySlot, lateSlot] = res.body.slots as BoardSlot[]
        expect(earlySlot!.seats.map((s) => s.seatNumber)).toEqual(["A1", "A2"])
        expect(seatsOf(earlySlot).A1).toMatchObject({
            state: "BOOKED",
            booking: {
                id: booking.id,
                bookingCode: booking.bookingCode,
                status: "CONFIRMED",
                itemStatus: "CONFIRMED",
                holdExpiresAt: null,
                customer: { id: customer.id, firstName: "Asha", lastName: "Rao", phone: "9876543210" },
            },
        })
        expect(seatsOf(earlySlot).A2).toMatchObject({ state: "AVAILABLE", booking: null })
        // The same seat in the OTHER slot is free: a booking belongs to one slot only.
        expect(seatsOf(lateSlot).A1).toMatchObject({ state: "AVAILABLE", booking: null })
        expect(earlySlot!.summary).toEqual({ capacity: 2, booked: 1, available: 1 })
        expect(lateSlot!.summary).toEqual({ capacity: 2, booked: 0, available: 2 })
    })

    it("only shows the requested day (other days' bookings do not leak in)", async () => {
        const slot = await createTimeSlot()
        const seat = await createSeat({ seatNumber: "A1" })
        await occupy({ seatId: seat.id, slotId: slot.id, dates: [D2] })

        const res = await board(`?date=${D1}`)

        expect(seatsOf(res.body.slots[0]).A1!.state).toBe("AVAILABLE")
    })

    it("does not expose the customer's e-mail or any password data on the floor view", async () => {
        const slot = await createTimeSlot()
        const seat = await createSeat({ seatNumber: "A1" })
        const customer = await createVerifiedUser()
        await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], userId: customer.id })

        const text = JSON.stringify((await board(`?date=${D1}`)).body)

        expect(text).not.toContain(customer.email)
        expect(text).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/)
    })

    describe("unpaid holds", () => {
        it("a hold still inside its payment window shows as BOOKED, with the deadline", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A1" })
            const expiresAt = new Date(Date.now() + 5 * 60_000)
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", bookingStatus: "PENDING", expiresAt })

            const seatView = seatsOf((await board(`?date=${D1}`)).body.slots[0]).A1!

            expect(seatView.state).toBe("BOOKED")
            expect(seatView.booking).toMatchObject({ status: "PENDING", itemStatus: "HELD", holdExpiresAt: expiresAt.toISOString() })
        })

        it("a hold PAST its payment window shows the seat as free (same rule as availability and booking)", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A1" })
            await occupy({
                seatId: seat.id,
                slotId: slot.id,
                dates: [D1],
                itemStatus: "HELD",
                bookingStatus: "PENDING",
                expiresAt: new Date(Date.now() - 60_000),
            })

            const res = await board(`?date=${D1}`)

            expect(seatsOf(res.body.slots[0]).A1).toMatchObject({ state: "AVAILABLE", booking: null })
            expect(res.body.slots[0].summary.booked).toBe(0)
        })

        it("a released item (cancelled / expired / failed) frees the seat", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A1" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "RELEASED", bookingStatus: "EXPIRED" })

            expect(seatsOf((await board(`?date=${D1}`)).body.slots[0]).A1!.state).toBe("AVAILABLE")
        })
    })

    describe("seats out of service", () => {
        it.each(["MAINTENANCE", "INACTIVE"] as const)("a %s seat shows its status and is left out of capacity", async (status) => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A1" })
            await createSeat({ seatNumber: "A2", status })

            const [shown] = (await board(`?date=${D1}`)).body.slots as BoardSlot[]

            expect(seatsOf(shown).A2!.state).toBe(status)
            expect(shown!.summary).toEqual({ capacity: 1, booked: 0, available: 1 })
            expect(shown!.timeSlot.id).toBe(slot.id)
        })

        it("a booking that sits on an out-of-service seat is still shown (staff must see it) but not counted as occupancy", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A1", status: "MAINTENANCE" })
            await createSeat({ seatNumber: "A2" })
            const booking = await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            const [shown] = (await board(`?date=${D1}`)).body.slots as BoardSlot[]

            expect(seatsOf(shown).A1).toMatchObject({ state: "MAINTENANCE", booking: { id: booking.id } })
            expect(shown!.summary).toEqual({ capacity: 1, booked: 0, available: 1 })
        })
    })

    describe("inactive time slots", () => {
        it("an inactive slot is hidden when it has no bookings that day", async () => {
            await createTimeSlot({ displayName: "off", isActive: false })
            await createSeat({ seatNumber: "A1" })

            expect((await board(`?date=${D1}`)).body.slots).toEqual([])
        })

        it("an inactive slot still shows on a day it has bookings, so history stays visible", async () => {
            const slot = await createTimeSlot({ displayName: "off", isActive: false })
            const seat = await createSeat({ seatNumber: "A1" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            const res = await board(`?date=${D1}`)

            expect(res.body.slots).toHaveLength(1)
            expect(res.body.slots[0].timeSlot).toMatchObject({ displayName: "off", isActive: false })
        })
    })

    it("works for a past day (history)", async () => {
        const slot = await createTimeSlot()
        const seat = await createSeat({ seatNumber: "A1" })
        await occupy({ seatId: seat.id, slotId: slot.id, dates: ["2024-01-15"] })

        const res = await board("?date=2024-01-15")

        expect(res.status).toBe(200)
        expect(seatsOf(res.body.slots[0]).A1!.state).toBe("BOOKED")
    })

    it("an empty workspace (no seats) is a valid, empty board, not an error", async () => {
        await createTimeSlot()
        const res = await board(`?date=${D1}`)
        expect(res.status).toBe(200)
        expect(res.body.slots[0]).toMatchObject({ seats: [], summary: { capacity: 0, booked: 0, available: 0 } })
    })

    it.each(["2026-02-30", "2026-8-1", "tomorrow", "0000-01-01", "' OR '1'='1"])("rejects the invalid date %j with 400", async (date) => {
        expect((await board(`?date=${encodeURIComponent(date)}`)).status).toBe(400)
    })

    it("rejects a repeated date parameter with 400 instead of guessing", async () => {
        expect((await board(`?date=${D1}&date=${D2}`)).status).toBe(400)
    })
})
