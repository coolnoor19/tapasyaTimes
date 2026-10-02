import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { count, eq } from "drizzle-orm"
import { db } from "../../src/db/index.js"
import {
    bookingItemsTable,
    bookingsTable,
    paymentsTable,
    timeSlotsTable,
    usersTable,
} from "../../src/db/schema.js"
import { getUniqueViolation } from "../../src/utils/dbErrors.js"
import { closeDb, hasTestDb, pgCode, resetDb } from "../helpers/db.js"
import { createBooking, createSeat, createTimeSlot, createUser, itemValues } from "../helpers/factories.js"

const DATE = "2026-08-11"

// The database is the last line of defence against double booking, so these
// run against a REAL Postgres (TEST_DATABASE_URL), including real concurrency.
describe.skipIf(!hasTestDb)("database rules", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    async function setup() {
        const user = await createUser()
        const seat = await createSeat()
        const slot = await createTimeSlot()
        return { user, seat, slot }
    }

    describe("double booking protection (seat + date + time slot)", () => {
        it("blocks a second HELD item for the same seat, date and slot", async () => {
            const { user, seat, slot } = await setup()
            const b1 = await createBooking(user.id)
            const b2 = await createBooking(user.id)
            await db.insert(bookingItemsTable).values(itemValues(b1.id, seat.id, slot.id, DATE))

            const error = await db
                .insert(bookingItemsTable)
                .values(itemValues(b2.id, seat.id, slot.id, DATE))
                .then(() => undefined, (err: unknown) => err)

            expect(getUniqueViolation(error)?.constraint).toBe("booking_items_active_slot_uq")
        })

        it("blocks a booking against a CONFIRMED item too", async () => {
            const { user, seat, slot } = await setup()
            const b1 = await createBooking(user.id)
            const b2 = await createBooking(user.id)
            await db.insert(bookingItemsTable).values(itemValues(b1.id, seat.id, slot.id, DATE, { status: "CONFIRMED" }))

            await expect(
                db.insert(bookingItemsTable).values(itemValues(b2.id, seat.id, slot.id, DATE)),
            ).rejects.toSatisfy((err) => pgCode(err) === "23505")
        })

        it("allows the same seat on a different date, in a different slot, or a different seat", async () => {
            const { user, seat, slot } = await setup()
            const otherSeat = await createSeat()
            const otherSlot = await createTimeSlot({ startTime: "11:00", endTime: "12:00" })
            const b = await createBooking(user.id)

            await db.insert(bookingItemsTable).values([
                itemValues(b.id, seat.id, slot.id, DATE),
                itemValues(b.id, seat.id, slot.id, "2026-08-12"),
                itemValues(b.id, seat.id, otherSlot.id, DATE),
                itemValues(b.id, otherSeat.id, slot.id, DATE),
            ])

            const [{ total }] = (await db.select({ total: count() }).from(bookingItemsTable)) as [{ total: number }]
            expect(total).toBe(4)
        })

        it("frees the slot once the item is RELEASED, so it can be booked again", async () => {
            const { user, seat, slot } = await setup()
            const b1 = await createBooking(user.id)
            const b2 = await createBooking(user.id)
            const [first] = await db.insert(bookingItemsTable).values(itemValues(b1.id, seat.id, slot.id, DATE)).returning()

            await db.update(bookingItemsTable).set({ status: "RELEASED" }).where(eq(bookingItemsTable.id, first!.id))

            await expect(
                db.insert(bookingItemsTable).values(itemValues(b2.id, seat.id, slot.id, DATE)),
            ).resolves.toBeDefined()
        })

        it("lets many RELEASED items for the same unit exist (history is kept)", async () => {
            const { user, seat, slot } = await setup()
            const b = await createBooking(user.id)
            await db.insert(bookingItemsTable).values([
                itemValues(b.id, seat.id, slot.id, DATE, { status: "RELEASED" }),
                itemValues(b.id, seat.id, slot.id, DATE, { status: "RELEASED" }),
            ])
        })

        it("lets exactly ONE of 10 simultaneous bookings of the same unit win", async () => {
            const { user, seat, slot } = await setup()
            const bookings = await Promise.all(Array.from({ length: 10 }, () => createBooking(user.id)))

            const results = await Promise.allSettled(
                bookings.map((b) => db.insert(bookingItemsTable).values(itemValues(b.id, seat.id, slot.id, DATE))),
            )

            const winners = results.filter((r) => r.status === "fulfilled")
            const losers = results.filter((r) => r.status === "rejected")
            expect(winners).toHaveLength(1)
            expect(losers).toHaveLength(9)
            for (const loser of losers) {
                expect(pgCode((loser as PromiseRejectedResult).reason)).toBe("23505")
            }
        })
    })

    describe("all-or-nothing multi-date booking (transaction)", () => {
        it("rolls back the booking and earlier items when one date is already taken", async () => {
            const { user, seat, slot } = await setup()
            const other = await createBooking(user.id)
            await db.insert(bookingItemsTable).values(itemValues(other.id, seat.id, slot.id, "2026-08-13"))
            const bookingsBefore = (await db.select({ total: count() }).from(bookingsTable))[0]!.total

            const attempt = db.transaction(async (tx) => {
                const [booking] = await tx
                    .insert(bookingsTable)
                    .values({ bookingCode: "TT-ROLLBACK", userId: user.id, totalAmountPaise: 30000 })
                    .returning()
                for (const date of ["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14"]) {
                    await tx.insert(bookingItemsTable).values(itemValues(booking!.id, seat.id, slot.id, date))
                }
            })

            await expect(attempt).rejects.toSatisfy((err) => getUniqueViolation(err) !== undefined)

            // Only the pre-existing booking and its single item remain: nothing partial.
            expect((await db.select({ total: count() }).from(bookingsTable))[0]!.total).toBe(bookingsBefore)
            expect((await db.select({ total: count() }).from(bookingItemsTable))[0]!.total).toBe(1)
        })

        it("commits everything when all dates are free", async () => {
            const { user, seat, slot } = await setup()

            await db.transaction(async (tx) => {
                const [booking] = await tx
                    .insert(bookingsTable)
                    .values({ bookingCode: "TT-OK", userId: user.id, totalAmountPaise: 50000 })
                    .returning()
                await tx.insert(bookingItemsTable).values(
                    ["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-14", "2026-08-15"].map((date) =>
                        itemValues(booking!.id, seat.id, slot.id, date),
                    ),
                )
            })

            expect((await db.select({ total: count() }).from(bookingItemsTable))[0]!.total).toBe(5)
        })
    })

    describe("data integrity rules", () => {
        it("rejects a negative item amount", async () => {
            const { user, seat, slot } = await setup()
            const b = await createBooking(user.id)
            await expect(
                db.insert(bookingItemsTable).values(itemValues(b.id, seat.id, slot.id, DATE, { amountPaise: -1 })),
            ).rejects.toSatisfy((err) => pgCode(err) === "23514")
        })

        it("rejects a negative booking total", async () => {
            const user = await createUser()
            await expect(createBooking(user.id, { totalAmountPaise: -5 })).rejects.toSatisfy((err) => pgCode(err) === "23514")
        })

        it.each([
            ["end before start", { startTime: "12:00", endTime: "11:00" }],
            ["end equal to start", { startTime: "12:00", endTime: "12:00" }],
        ])("rejects a time slot with %s", async (_label, times) => {
            await expect(db.insert(timeSlotsTable).values({ ...times, displayName: "bad" })).rejects.toSatisfy(
                (err) => pgCode(err) === "23514",
            )
        })

        it("rejects an email that is not lowercase", async () => {
            await expect(createUser({ email: "Mixed@Example.com" })).rejects.toSatisfy((err) => pgCode(err) === "23514")
        })

        it("rejects duplicate email and duplicate phone", async () => {
            await createUser({ email: "a@example.com", phone: "9111111111" })
            await expect(createUser({ email: "a@example.com", phone: "9222222222" })).rejects.toSatisfy(
                (err) => getUniqueViolation(err)?.constraint === "users_email_unique",
            )
            await expect(createUser({ email: "b@example.com", phone: "9111111111" })).rejects.toSatisfy(
                (err) => getUniqueViolation(err)?.constraint === "users_phone_unique",
            )
        })

        it("allows only one payment per booking", async () => {
            const user = await createUser()
            const booking = await createBooking(user.id)
            await db.insert(paymentsTable).values({ bookingId: booking.id, amountPaise: 100, razorpayOrderId: "order_1" })

            await expect(
                db.insert(paymentsTable).values({ bookingId: booking.id, amountPaise: 100, razorpayOrderId: "order_2" }),
            ).rejects.toSatisfy((err) => getUniqueViolation(err) !== undefined)
        })

        it("refuses to delete a user who has bookings (history is protected)", async () => {
            const user = await createUser()
            await createBooking(user.id)
            // 23001 = restrict_violation (what ON DELETE RESTRICT raises)
            await expect(db.delete(usersTable).where(eq(usersTable.id, user.id))).rejects.toSatisfy(
                (err) => pgCode(err) === "23001",
            )
        })

        it("stores booking_date as a plain calendar date with no timezone shift", async () => {
            const { user, seat, slot } = await setup()
            const b = await createBooking(user.id)
            await db.insert(bookingItemsTable).values(itemValues(b.id, seat.id, slot.id, "2026-12-31"))
            const [row] = await db.select({ date: bookingItemsTable.bookingDate }).from(bookingItemsTable)
            expect(row!.date).toBe("2026-12-31")
        })
    })
})
