import { afterAll, beforeEach, describe, expect, it } from "vitest"
import request from "supertest"
import { count, eq, sql } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import {
    bookingItemsTable,
    bookingsTable,
    seatPricesTable,
    seatsTable,
    timeSlotsTable,
} from "../../src/db/schema.js"
import { createBooking as createBookingService } from "../../src/services/booking.service.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { createSeat, createTimeSlot } from "../helpers/factories.js"
import { futureDate, occupy, postBooking, setupWorld, tokenFor } from "../helpers/booking.js"

const app = createApp()
const [D1, D2, D3, D4, D5] = [2, 3, 4, 5, 6].map(futureDate) as [string, string, string, string, string]

const rowCount = async (table: typeof bookingsTable | typeof bookingItemsTable) =>
    (await db.select({ n: count() }).from(table))[0]!.n

describe.skipIf(!hasTestDb)("POST /api/v1/bookings", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    describe("a successful booking", () => {
        it("creates a PENDING booking with one HELD item per date, priced by the backend", async () => {
            const { seat, slot, token } = await setupWorld()

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2, D3, D4, D5] })

            expect(res.status).toBe(201)
            expect(res.body).toMatchObject({
                status: "PENDING",
                totalAmountPaise: 75000, // 5 dates x Rs 150
                currency: "INR",
                seat: { id: seat.id, seatNumber: "A01", seatType: "EXECUTIVE" },
                timeSlot: { id: slot.id, startTime: "10:00", endTime: "11:00" },
            })
            expect(res.body.bookingCode).toMatch(/^TT-[0-9A-HJKMNP-TV-Z]{8}$/)
            expect(res.body.items).toHaveLength(5)
            expect(res.body.items.map((i: { date: string }) => i.date)).toEqual([D1, D2, D3, D4, D5])
            expect(res.body.items.every((i: { amountPaise: number; status: string }) => i.amountPaise === 15000 && i.status === "HELD")).toBe(true)
            expect(res.headers["cache-control"]).toBe("no-store")
        })

        it("stores the booking and items in the database, owned by the caller", async () => {
            const { seat, slot, user, token } = await setupWorld()

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2] })

            const [booking] = await db.select().from(bookingsTable)
            expect(booking).toMatchObject({ id: res.body.id, userId: user.id, status: "PENDING", totalAmountPaise: 30000 })
            expect(await rowCount(bookingItemsTable)).toBe(2)
        })

        it("holds the seat for 10 minutes", async () => {
            const { seat, slot, token } = await setupWorld()

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            const minutes = (new Date(res.body.expiresAt).getTime() - Date.now()) / 60_000
            expect(minutes).toBeGreaterThan(9.5)
            expect(minutes).toBeLessThanOrEqual(10)
        })

        it("does not expose the owner's id", async () => {
            const { seat, slot, user, token } = await setupWorld()
            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })
            expect(JSON.stringify(res.body)).not.toContain(user.id)
        })

        it("accepts dates in any order and non-consecutive dates", async () => {
            const { seat, slot, token } = await setupWorld()
            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D5, D1, D3] })
            expect(res.status).toBe(201)
            expect(res.body.items.map((i: { date: string }) => i.date)).toEqual([D1, D3, D5])
        })

        it("inserts the dates in ascending order whatever order the client sent (this prevents deadlocks)", async () => {
            const { seat, slot, token } = await setupWorld()

            await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D5, D2, D4, D1, D3] })

            // ctid = the row's physical position, i.e. the order it was inserted in
            const { rows } = await db.execute<{ d: string }>(sql`SELECT booking_date::text AS d FROM booking_items ORDER BY ctid`)
            expect(rows.map((r) => r.d)).toEqual([D1, D2, D3, D4, D5])
        })

        it("shows the seat as BOOKED on the availability screen straight away", async () => {
            const { seat, slot, token } = await setupWorld()
            await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D2] })

            const res = await request(app)
                .get("/api/v1/seats/availability")
                .query({ dates: [D1, D2, D3].join(","), timeSlotId: slot.id })
                .set("Authorization", `Bearer ${token}`)

            expect(res.body.seats[0]).toMatchObject({ seatNumber: "A01", availability: "BOOKED", bookedDates: [D2] })
        })
    })

    describe("pricing is decided by the backend", () => {
        it("ignores any amount, total, status or owner sent by the client", async () => {
            const { seat, slot, user, token } = await setupWorld()
            const stranger = await createVerifiedUser()

            const res = await postBooking(app, token, {
                seatId: seat.id,
                timeSlotId: slot.id,
                dates: [D1],
                totalAmountPaise: 1,
                amountPaise: 1,
                status: "CONFIRMED",
                userId: stranger.id,
            })

            expect(res.status).toBe(201)
            expect(res.body).toMatchObject({ totalAmountPaise: 15000, status: "PENDING" })
            expect((await db.select().from(bookingsTable))[0]!.userId).toBe(user.id)
        })

        it("keeps the old price on existing bookings when the price changes later (snapshot)", async () => {
            const { seat, slot, token } = await setupWorld()
            const first = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            await db.update(seatPricesTable).set({ pricePerHourPaise: 99999 })
            const second = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D2] })

            const [stored] = await db.select().from(bookingItemsTable).where(eq(bookingItemsTable.bookingId, first.body.id))
            expect(stored!.amountPaise).toBe(15000)
            expect(second.body.totalAmountPaise).toBe(99999)
        })

        it("pro-rates a slot that is not exactly one hour", async () => {
            const { seat, token } = await setupWorld()
            const longSlot = await createTimeSlot({ startTime: "12:00", endTime: "13:30", displayName: "90 min" })

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: longSlot.id, dates: [D1, D2] })

            expect(res.body.items[0].amountPaise).toBe(22500) // 1.5 h x Rs 150
            expect(res.body.totalAmountPaise).toBe(45000)
        })

        it("refuses to book when no price is configured, and creates nothing", async () => {
            const { seat, slot, token } = await setupWorld({ priceType: false })

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            expect(res.status).toBe(500)
            expect(res.body.code).toBe("PRICING_NOT_CONFIGURED")
            expect(await rowCount(bookingsTable)).toBe(0)
            expect(await rowCount(bookingItemsTable)).toBe(0)
        })
    })

    describe("no false conflicts", () => {
        it("different seats, different slots and different dates can all be booked", async () => {
            const { seat, slot, token } = await setupWorld()
            const otherSeat = await createSeat({ seatNumber: "A02", seatType: "EXECUTIVE" })
            const otherSlot = await createTimeSlot({ startTime: "11:00", endTime: "12:00", displayName: "11-12" })
            const other = await createVerifiedUser()
            const otherToken = await tokenFor(other.id)

            const results = await Promise.all([
                postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }),
                postBooking(app, otherToken, { seatId: otherSeat.id, timeSlotId: slot.id, dates: [D1] }), // other seat
                postBooking(app, otherToken, { seatId: seat.id, timeSlotId: otherSlot.id, dates: [D1] }), // other slot
                postBooking(app, otherToken, { seatId: seat.id, timeSlotId: slot.id, dates: [D2] }), // other date
            ])

            expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201])
        })

        it("a RELEASED item no longer blocks the seat", async () => {
            const { seat, slot, token } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D1], itemStatus: "RELEASED" })

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            expect(res.status).toBe(201)
        })
    })

    describe("conflicts: the seat is taken", () => {
        it("refuses with 409 and lists the taken date, creating NOTHING (all-or-nothing)", async () => {
            const { seat, slot, token } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D3] })
            const bookingsBefore = await rowCount(bookingsTable)
            const itemsBefore = await rowCount(bookingItemsTable)

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2, D3, D4, D5] })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SEAT_TAKEN")
            expect(res.body.details).toEqual({ conflictingDates: [D3] })
            expect(res.body.message).toContain("A01")
            expect(res.body.message).toContain(D3)
            // dates 1, 2, 4 and 5 were free, but none of them was booked
            expect(await rowCount(bookingsTable)).toBe(bookingsBefore)
            expect(await rowCount(bookingItemsTable)).toBe(itemsBefore)
        })

        it("lists every taken date, sorted", async () => {
            const { seat, slot, token } = await setupWorld()
            await occupy({ seatId: seat.id, slotId: slot.id, dates: [D4, D2] })

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2, D3, D4] })

            expect(res.body.details.conflictingDates).toEqual([D2, D4])
        })

        it("an unpaid hold that is still open blocks the seat", async () => {
            const { seat, slot, token } = await setupWorld()
            await occupy({
                seatId: seat.id, slotId: slot.id, dates: [D1],
                itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: new Date(Date.now() + 5 * 60_000),
            })

            expect((await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })).status).toBe(409)
        })

        it("clicking twice without an Idempotency-Key cannot create a second booking", async () => {
            const { seat, slot, token } = await setupWorld()
            const body = { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2] }

            const first = await postBooking(app, token, body)
            const second = await postBooking(app, token, body)

            expect(first.status).toBe(201)
            expect(second.status).toBe(409)
            expect(await rowCount(bookingsTable)).toBe(1)
        })

        it("a CONFIRMED booking blocks the seat even though its old deadline has passed", async () => {
            const { seat, slot, token } = await setupWorld()
            await occupy({
                seatId: seat.id, slotId: slot.id, dates: [D1],
                itemStatus: "CONFIRMED", bookingStatus: "CONFIRMED", expiresAt: new Date(Date.now() - 60_000),
            })

            expect((await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })).status).toBe(409)
        })
    })

    describe("expired unpaid holds are released when someone else books", () => {
        it("lets the new booking succeed and expires the abandoned one completely", async () => {
            const { seat, slot, token } = await setupWorld()
            // someone abandoned a 2-date booking 1 minute after its 10 minute window closed
            const abandoned = await occupy({
                seatId: seat.id, slotId: slot.id, dates: [D1, D2],
                itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: new Date(Date.now() - 60_000),
            })

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D2] })

            expect(res.status).toBe(201)
            const [old] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, abandoned.id))
            expect(old!.status).toBe("EXPIRED")
            const oldItems = await db.select().from(bookingItemsTable).where(eq(bookingItemsTable.bookingId, abandoned.id))
            expect(oldItems.map((i) => i.status)).toEqual(["RELEASED", "RELEASED"]) // including D1, which nobody asked for
        })

        it("only touches the units being booked: an expired hold elsewhere is left alone", async () => {
            const { seat, slot, token } = await setupWorld()
            const elsewhere = await occupy({
                seatId: seat.id, slotId: slot.id, dates: [D5],
                itemStatus: "HELD", bookingStatus: "PENDING", expiresAt: new Date(Date.now() - 60_000),
            })

            await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            const [untouched] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, elsewhere.id))
            expect(untouched!.status).toBe("PENDING")
        })

        it("is judged by the clock it is given (service level)", async () => {
            const { seat, slot, user } = await setupWorld()
            const other = await createVerifiedUser()
            const bookedAt = new Date("2099-01-01T05:00:00Z")
            const first = await createBookingService(
                { userId: other.id, seatId: seat.id, timeSlotId: slot.id, dates: ["2099-01-10"] },
                bookedAt,
            )
            expect(first.booking.expiresAt).toBe("2099-01-01T05:10:00.000Z") // exactly now + 10 minutes

            const input = { userId: user.id, seatId: seat.id, timeSlotId: slot.id, dates: ["2099-01-10"] }
            await expect(createBookingService(input, new Date("2099-01-01T05:09:59Z"))).rejects.toMatchObject({ statusCode: 409 })
            await expect(createBookingService(input, new Date("2099-01-01T05:10:01Z"))).resolves.toBeDefined()
        })
    })

    describe("seat and slot rules", () => {
        it.each(["MAINTENANCE", "INACTIVE"] as const)("refuses a seat that is %s", async (status) => {
            const { seat, slot, token } = await setupWorld()
            await db.update(seatsTable).set({ status }).where(eq(seatsTable.id, seat.id))

            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })

            expect(res.status).toBe(409)
            expect(res.body.code).toBe("SEAT_UNAVAILABLE")
            expect(await rowCount(bookingsTable)).toBe(0)
        })

        it("404 for a seat or slot that does not exist, and for an inactive slot", async () => {
            const { seat, slot, token } = await setupWorld()
            const ghost = "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"

            expect((await postBooking(app, token, { seatId: ghost, timeSlotId: slot.id, dates: [D1] })).status).toBe(404)
            expect((await postBooking(app, token, { seatId: seat.id, timeSlotId: ghost, dates: [D1] })).status).toBe(404)

            await db.update(timeSlotsTable).set({ isActive: false }).where(eq(timeSlotsTable.id, slot.id))
            expect((await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })).status).toBe(404)
        })
    })

    describe("input and access", () => {
        it("requires login", async () => {
            const { seat, slot } = await setupWorld()
            expect((await postBooking(app, undefined, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })).status).toBe(401)
        })

        it("refuses a past date, naming it", async () => {
            const { seat, slot, token } = await setupWorld()
            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(-1), D1] })
            expect(res.status).toBe(400)
            expect(res.body.message).toContain(futureDate(-1))
            expect(await rowCount(bookingsTable)).toBe(0)
        })

        it("refuses today for a slot that has already started (fixed clock)", async () => {
            const { seat, slot, user } = await setupWorld()
            const eleven = new Date("2099-06-01T05:30:00Z") // 11:00 IST; the slot started at 10:00
            await expect(
                createBookingService({ userId: user.id, seatId: seat.id, timeSlotId: slot.id, dates: ["2099-06-01"] }, eleven),
            ).rejects.toMatchObject({ statusCode: 400, message: "This time slot has already started today" })
            expect(await rowCount(bookingsTable)).toBe(0)
        })

        it.each([
            ["no seat", (s: string, t: string) => ({ timeSlotId: t, dates: [D1] })],
            ["a malformed seat id", (_s: string, t: string) => ({ seatId: "A01", timeSlotId: t, dates: [D1] })],
            ["no dates", (s: string, t: string) => ({ seatId: s, timeSlotId: t })],
            ["duplicate dates", (s: string, t: string) => ({ seatId: s, timeSlotId: t, dates: [D1, D1] })],
            ["an impossible date", (s: string, t: string) => ({ seatId: s, timeSlotId: t, dates: ["2030-02-30"] })],
            ["32 dates", (s: string, t: string) => ({ seatId: s, timeSlotId: t, dates: Array.from({ length: 32 }, (_, i) => futureDate(i + 1)) })],
        ])("returns 400 for %s and creates nothing", async (_label, makeBody) => {
            const { seat, slot, token } = await setupWorld()
            const res = await postBooking(app, token, makeBody(seat.id, slot.id))
            expect(res.status).toBe(400)
            expect(await rowCount(bookingsTable)).toBe(0)
        })

        it("accepts exactly 31 dates", async () => {
            const { seat, slot, token } = await setupWorld()
            const dates = Array.from({ length: 31 }, (_, i) => futureDate(i + 1))
            const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates })
            expect(res.status).toBe(201)
            expect(res.body.items).toHaveLength(31)
            expect(res.body.totalAmountPaise).toBe(31 * 15000)
        })
    })
})
