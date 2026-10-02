import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { eq } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { bookingItemsTable, seatPricesTable, timeSlotsTable } from "../../src/db/schema.js"
import { getSeatAvailability } from "../../src/services/availability.service.js"
import { getBusinessNow } from "../../src/utils/businessTime.js"
import { signAccessToken } from "../../src/utils/token.util.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { createBooking, createSeat, createTimeSlot, itemValues } from "../helpers/factories.js"

const app = createApp()

// Dates relative to "today" in India, so these tests never go stale.
function futureDate(daysAhead: number): string {
    const [year, month, day] = getBusinessNow().date.split("-").map(Number) as [number, number, number]
    return new Date(Date.UTC(year, month - 1, day + daysAhead)).toISOString().slice(0, 10)
}
const [D1, D2, D3, D4, D5] = [2, 3, 4, 5, 6].map(futureDate) as [string, string, string, string, string]

async function tokenFor(role: "USER" | "MANAGER" | "ADMIN" = "USER") {
    const user = await createVerifiedUser({ role })
    return signAccessToken(user.id)
}

async function availability(dates: string[], timeSlotId: string, token?: string) {
    const req = request(app).get("/api/v1/seats/availability").query({ dates: dates.join(","), timeSlotId })
    return token === undefined ? req : req.set("Authorization", `Bearer ${token}`)
}

type Seat = { seatNumber: string; availability: string; bookedDates: string[]; pricePerHourPaise: number | null }
const bySeat = (body: { seats: Seat[] }, seatNumber: string) => body.seats.find((s) => s.seatNumber === seatNumber)!

// Books a seat directly in the database (the booking API does not exist yet).
async function occupy(opts: {
    seatId: string
    slotId: string
    dates: string[]
    itemStatus?: "HELD" | "CONFIRMED" | "RELEASED"
    expiresAt?: Date | null
}) {
    const user = await createVerifiedUser()
    const booking = await createBooking(user.id, { expiresAt: opts.expiresAt ?? null })
    await db
        .insert(bookingItemsTable)
        .values(opts.dates.map((d) => itemValues(booking.id, opts.seatId, opts.slotId, d, { status: opts.itemStatus ?? "CONFIRMED" })))
}

describe.skipIf(!hasTestDb)("GET /api/v1/seats/availability", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("access", () => {
        it("requires login", async () => {
            const slot = await createTimeSlot()
            expect((await availability([D1], slot.id)).status).toBe(401)
        })

        it("is open to every role", async () => {
            const slot = await createTimeSlot()
            for (const role of ["USER", "MANAGER", "ADMIN"] as const) {
                expect((await availability([D1], slot.id, await tokenFor(role))).status).toBe(200)
            }
        })

        it("is never cached", async () => {
            const slot = await createTimeSlot()
            const res = await availability([D1], slot.id, await tokenFor())
            expect(res.headers["cache-control"]).toBe("no-store")
        })

        it("answers 401 before validating input", async () => {
            const res = await request(app).get("/api/v1/seats/availability?dates=garbage")
            expect(res.status).toBe(401)
        })
    })

    describe("the layout", () => {
        it("returns the slot, the sorted dates, and every seat in seat-number order", async () => {
            const slot = await createTimeSlot({ startTime: "10:00", endTime: "11:00", displayName: "10:00 - 11:00" })
            await createSeat({ seatNumber: "B02", seatType: "PROFESSIONAL" })
            await createSeat({ seatNumber: "A01", seatType: "EXECUTIVE" })
            await createSeat({ seatNumber: "A02", seatType: "EXECUTIVE", floor: 2 })

            const res = await availability([D3, D1, D2], slot.id, await tokenFor())

            expect(res.status).toBe(200)
            expect(res.body.timeSlot).toEqual({ id: slot.id, displayName: "10:00 - 11:00", startTime: "10:00", endTime: "11:00" })
            expect(res.body.dates).toEqual([D1, D2, D3])
            expect(res.body.seats.map((s: Seat) => s.seatNumber)).toEqual(["A01", "A02", "B02"])
            expect(res.body.seats[1]).toMatchObject({ seatType: "EXECUTIVE", floor: 2 })
        })

        it("marks every seat AVAILABLE when nothing is booked", async () => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A01" })
            await createSeat({ seatNumber: "A02" })

            const res = await availability([D1, D2], slot.id, await tokenFor())

            expect(res.body.seats.every((s: Seat) => s.availability === "AVAILABLE" && s.bookedDates.length === 0)).toBe(true)
        })

        it("returns an empty seat list when no seats exist", async () => {
            const slot = await createTimeSlot()
            const res = await availability([D1], slot.id, await tokenFor())
            expect(res.status).toBe(200)
            expect(res.body.seats).toEqual([])
        })

        it("includes the hourly price of each seat's category (null when none is set)", async () => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A01", seatType: "EXECUTIVE" })
            await createSeat({ seatNumber: "C01", seatType: "STUDY" })
            await db.insert(seatPricesTable).values({ seatType: "EXECUTIVE", pricePerHourPaise: 15000 })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").pricePerHourPaise).toBe(15000)
            expect(bySeat(res.body, "C01").pricePerHourPaise).toBeNull()
        })

        it("never reveals who booked a seat", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(JSON.stringify(res.body)).not.toMatch(/userId|user_id|bookingCode|email|TT-/i)
            expect(Object.keys(bySeat(res.body, "A01")).sort()).toEqual(
                ["availability", "bookedDates", "floor", "id", "pricePerHourPaise", "seatNumber", "seatType"],
            )
        })
    })

    describe("multi-date rule: a seat must be free on EVERY selected date", () => {
        it("the example from the spec: A01 free on all 5 dates, A02 taken on the 3rd", async () => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A01" })
            const a02 = await createSeat({ seatNumber: "A02" })
            await occupy({ seatId: a02.id, slotId: slot.id, dates: [D3] })

            const res = await availability([D1, D2, D3, D4, D5], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01")).toMatchObject({ availability: "AVAILABLE", bookedDates: [] })
            expect(bySeat(res.body, "A02")).toMatchObject({ availability: "BOOKED", bookedDates: [D3] })
        })

        it("lists every taken date, sorted", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D4, D2] })

            const res = await availability([D1, D2, D3, D4, D5], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").bookedDates).toEqual([D2, D4])
        })

        it("a seat taken on ALL selected dates is BOOKED", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1, D2] })

            const res = await availability([D1, D2], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01")).toMatchObject({ availability: "BOOKED", bookedDates: [D1, D2] })
        })

        it("one conflicting date out of 31 still blocks the seat", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            const dates = Array.from({ length: 31 }, (_, i) => futureDate(i + 1))
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [dates[30]!] })

            const res = await availability(dates, slot.id, await tokenFor())

            expect(res.status).toBe(200)
            expect(bySeat(res.body, "A01")).toMatchObject({ availability: "BOOKED", bookedDates: [dates[30]] })
        })

        it("a booking on a date you did NOT select does not matter", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D5] })

            const res = await availability([D1, D2], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").availability).toBe("AVAILABLE")
        })

        it("a booking in a DIFFERENT time slot does not matter", async () => {
            const slot = await createTimeSlot({ startTime: "10:00", endTime: "11:00" })
            const otherSlot = await createTimeSlot({ startTime: "11:00", endTime: "12:00" })
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: seat.id, slotId: otherSlot.id, dates: [D1] })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").availability).toBe("AVAILABLE")
        })

        it("only the booked seat is affected; its neighbours stay available", async () => {
            const slot = await createTimeSlot()
            const a01 = await createSeat({ seatNumber: "A01" })
            await createSeat({ seatNumber: "A02" })
            await occupy({ seatId: a01.id, slotId: slot.id, dates: [D1] })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").availability).toBe("BOOKED")
            expect(bySeat(res.body, "A02").availability).toBe("AVAILABLE")
        })

        it("returns dates as plain calendar strings (no time zone shift)", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").bookedDates).toEqual([D1])
            expect(bySeat(res.body, "A01").bookedDates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })
    })

    describe("physical seat status", () => {
        it("shows MAINTENANCE and INACTIVE seats as such", async () => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A01", status: "MAINTENANCE" })
            await createSeat({ seatNumber: "A02", status: "INACTIVE" })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").availability).toBe("MAINTENANCE")
            expect(bySeat(res.body, "A02").availability).toBe("INACTIVE")
        })

        it("still reports a seat in maintenance as MAINTENANCE when it also has bookings", async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01", status: "MAINTENANCE" })
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1] })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01")).toMatchObject({ availability: "MAINTENANCE", bookedDates: [D1] })
        })
    })

    describe("unpaid holds and released bookings", () => {
        const setup = async () => {
            const slot = await createTimeSlot()
            const seat = await createSeat({ seatNumber: "A01" })
            return { slot, seat }
        }

        it("a HELD item whose payment window is still open blocks the seat", async () => {
            const { slot, seat } = await setup()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", expiresAt: new Date(Date.now() + 5 * 60_000) })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").availability).toBe("BOOKED")
        })

        it("a HELD item whose payment window has EXPIRED no longer blocks the seat", async () => {
            const { slot, seat } = await setup()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", expiresAt: new Date(Date.now() - 60_000) })

            const res = await availability([D1], slot.id, await tokenFor())

            expect(bySeat(res.body, "A01").availability).toBe("AVAILABLE")
        })

        it("a HELD item with no deadline blocks the seat (safe default)", async () => {
            const { slot, seat } = await setup()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "HELD", expiresAt: null })

            expect(bySeat((await availability([D1], slot.id, await tokenFor())).body, "A01").availability).toBe("BOOKED")
        })

        it("a CONFIRMED item blocks the seat even if its booking has an old deadline", async () => {
            const { slot, seat } = await setup()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "CONFIRMED", expiresAt: new Date(Date.now() - 60_000) })

            expect(bySeat((await availability([D1], slot.id, await tokenFor())).body, "A01").availability).toBe("BOOKED")
        })

        it("a RELEASED (cancelled) item frees the seat", async () => {
            const { slot, seat } = await setup()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "RELEASED" })

            expect(bySeat((await availability([D1], slot.id, await tokenFor())).body, "A01").availability).toBe("AVAILABLE")
        })
    })

    describe("input errors", () => {
        const token = () => tokenFor()

        it("404 for a time slot that does not exist", async () => {
            const res = await availability([D1], "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f", await token())
            expect(res.status).toBe(404)
            expect(res.body.message).toBe("Time slot not found")
        })

        it("404 for an inactive time slot (it cannot be booked)", async () => {
            const slot = await createTimeSlot({ isActive: false })
            expect((await availability([D1], slot.id, await token())).status).toBe(404)
        })

        it("400 for a date in the past, naming it", async () => {
            const slot = await createTimeSlot()
            const res = await availability([futureDate(-1), D1], slot.id, await token())
            expect(res.status).toBe(400)
            expect(res.body.message).toContain(futureDate(-1))
        })

        it("400 when dates are missing", async () => {
            const slot = await createTimeSlot()
            const res = await request(app)
                .get("/api/v1/seats/availability")
                .query({ timeSlotId: slot.id })
                .set("Authorization", `Bearer ${await token()}`)
            expect(res.status).toBe(400)
            expect(res.body.message).toContain("dates")
        })

        it("400 for duplicate dates", async () => {
            const slot = await createTimeSlot()
            const res = await availability([D1, D1], slot.id, await token())
            expect(res.status).toBe(400)
            expect(res.body.message).toContain("repeat")
        })

        it("400 for more than 31 dates", async () => {
            const slot = await createTimeSlot()
            const dates = Array.from({ length: 32 }, (_, i) => futureDate(i + 1))
            const res = await availability(dates, slot.id, await token())
            expect(res.status).toBe(400)
            expect(res.body.message).toContain("31")
        })

        it("400 for an impossible date and for a malformed time slot id", async () => {
            const slot = await createTimeSlot()
            expect((await availability(["2030-02-30"], slot.id, await token())).status).toBe(400)
            expect((await availability([D1], "not-a-uuid", await token())).status).toBe(400)
        })

        it("accepts repeated query parameters as well as a comma list", async () => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A01" })
            const res = await request(app)
                .get(`/api/v1/seats/availability?dates=${D1}&dates=${D2}&timeSlotId=${slot.id}`)
                .set("Authorization", `Bearer ${await token()}`)
            expect(res.status).toBe(200)
            expect(res.body.dates).toEqual([D1, D2])
        })

        it("treats a SQL injection attempt as plain invalid input and leaves the data intact", async () => {
            const slot = await createTimeSlot()
            await createSeat({ seatNumber: "A01" })

            const res = await request(app)
                .get("/api/v1/seats/availability")
                .query({ dates: `${D1}'; DROP TABLE seats;--`, timeSlotId: slot.id })
                .set("Authorization", `Bearer ${await token()}`)

            expect(res.status).toBe(400)
            const after = await availability([D1], slot.id, await token())
            expect(after.body.seats).toHaveLength(1)
        })
    })

    describe("time rules with a fixed clock (service level)", () => {
        // 11:00 AM on 11 Aug 2026, India time
        const now = new Date("2026-08-11T05:30:00Z")

        it("rejects today for a slot that already started", async () => {
            const slot = await createTimeSlot({ startTime: "09:00", endTime: "10:00" })
            await expect(getSeatAvailability({ dates: ["2026-08-11"], timeSlotId: slot.id }, now)).rejects.toMatchObject({
                statusCode: 400,
                message: "This time slot has already started today",
            })
        })

        it("allows today for a slot that starts later", async () => {
            const slot = await createTimeSlot({ startTime: "12:00", endTime: "13:00" })
            const result = await getSeatAvailability({ dates: ["2026-08-11"], timeSlotId: slot.id }, now)
            expect(result.dates).toEqual(["2026-08-11"])
        })

        it("rejects a mixed request when only one date is in the past", async () => {
            const slot = await createTimeSlot({ startTime: "12:00", endTime: "13:00" })
            await expect(
                getSeatAvailability({ dates: ["2026-08-10", "2026-08-12"], timeSlotId: slot.id }, now),
            ).rejects.toMatchObject({ statusCode: 400 })
        })

        it("uses India time: just after midnight IST, the previous (UTC) day is already in the past", async () => {
            const slot = await createTimeSlot({ startTime: "09:00", endTime: "10:00" })
            const justAfterMidnightIST = new Date("2026-08-10T18:45:00Z") // 00:15 on the 11th in India

            await expect(
                getSeatAvailability({ dates: ["2026-08-10"], timeSlotId: slot.id }, justAfterMidnightIST),
            ).rejects.toMatchObject({ statusCode: 400 })
            await expect(
                getSeatAvailability({ dates: ["2026-08-11"], timeSlotId: slot.id }, justAfterMidnightIST),
            ).resolves.toBeDefined()
        })

        it("an expired hold is judged against the injected clock", async () => {
            const slot = await createTimeSlot({ startTime: "12:00", endTime: "13:00" })
            const seat = await createSeat({ seatNumber: "A01" })
            await occupy({
                seatId: seat.id,
                slotId: slot.id,
                dates: ["2026-08-12"],
                itemStatus: "HELD",
                expiresAt: new Date("2026-08-11T05:35:00Z"), // 5 minutes after `now`
            })

            const before = await getSeatAvailability({ dates: ["2026-08-12"], timeSlotId: slot.id }, now)
            const after = await getSeatAvailability({ dates: ["2026-08-12"], timeSlotId: slot.id }, new Date("2026-08-11T05:40:00Z"))

            expect(before.seats[0]!.availability).toBe("BOOKED")
            expect(after.seats[0]!.availability).toBe("AVAILABLE")
        })

        it("deactivating a slot afterwards makes it unavailable", async () => {
            const slot = await createTimeSlot({ startTime: "12:00", endTime: "13:00" })
            await db.update(timeSlotsTable).set({ isActive: false }).where(eq(timeSlotsTable.id, slot.id))
            await expect(getSeatAvailability({ dates: ["2026-08-12"], timeSlotId: slot.id }, now)).rejects.toMatchObject({
                statusCode: 404,
            })
        })
    })
})
