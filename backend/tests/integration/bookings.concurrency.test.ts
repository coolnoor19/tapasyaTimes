import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { count } from "drizzle-orm"
import { createApp } from "../../src/app.js"
import { db } from "../../src/db/index.js"
import { bookingItemsTable, bookingsTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { createSeat } from "../helpers/factories.js"
import { futureDate, postBooking, setupWorld, tokenFor } from "../helpers/booking.js"

const app = createApp()
const [D1, D2, D3, D4, D5] = [2, 3, 4, 5, 6].map(futureDate) as [string, string, string, string, string]

const rowCount = async (table: typeof bookingsTable | typeof bookingItemsTable) =>
    (await db.select({ n: count() }).from(table))[0]!.n

async function manyUsers(n: number) {
    return Promise.all(Array.from({ length: n }, async () => tokenFor((await createVerifiedUser()).id)))
}

// The reason the unique index exists: real parallel requests, real Postgres.
describe.skipIf(!hasTestDb)("booking under concurrency", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("lets exactly ONE of 10 users who click the same seat at the same moment win", async () => {
        const { seat, slot } = await setupWorld()
        const tokens = await manyUsers(10)

        const results = await Promise.all(
            tokens.map((token) => postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })),
        )

        expect(results.filter((r) => r.status === 201)).toHaveLength(1)
        const losers = results.filter((r) => r.status !== 201)
        expect(losers).toHaveLength(9)
        expect(losers.every((r) => r.status === 409 && r.body.code === "SEAT_TAKEN")).toBe(true)
        expect(results.some((r) => r.status >= 500)).toBe(false)
        // and the losers left nothing behind: no orphan booking rows
        expect(await rowCount(bookingsTable)).toBe(1)
        expect(await rowCount(bookingItemsTable)).toBe(1)
    })

    it("overlapping multi-date bookings: A wants days 1-3, B wants days 3-5; one wins, the loser leaves nothing", async () => {
        const { seat, slot } = await setupWorld()
        const [a, b] = await manyUsers(2)

        const [resA, resB] = await Promise.all([
            postBooking(app, a!, { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2, D3] }),
            postBooking(app, b!, { seatId: seat.id, timeSlotId: slot.id, dates: [D3, D4, D5] }),
        ])

        expect([resA.status, resB.status].sort()).toEqual([201, 409])
        expect(await rowCount(bookingsTable)).toBe(1)
        expect(await rowCount(bookingItemsTable)).toBe(3) // 3 items of the winner, none of the loser
    })

    it("does not deadlock when requests list the same dates in opposite orders (8 at once)", async () => {
        const { seat, slot } = await setupWorld()
        const tokens = await manyUsers(8)
        const forward = [D1, D2, D3, D4, D5]
        const backward = [...forward].reverse()

        const results = await Promise.all(
            tokens.map((token, i) =>
                postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: i % 2 === 0 ? forward : backward }),
            ),
        )

        expect(results.some((r) => r.status >= 500)).toBe(false)
        expect(results.filter((r) => r.status === 201)).toHaveLength(1)
        expect(results.filter((r) => r.status === 409)).toHaveLength(7)
        expect(await rowCount(bookingItemsTable)).toBe(5)
    })

    it("different seats at the same time do not block each other", async () => {
        const { slot } = await setupWorld()
        const seats = await Promise.all(
            Array.from({ length: 6 }, (_, i) => createSeat({ seatNumber: `E0${i + 1}`, seatType: "EXECUTIVE" })),
        )
        const tokens = await manyUsers(6)

        const results = await Promise.all(
            tokens.map((token, i) => postBooking(app, token, { seatId: seats[i]!.id, timeSlotId: slot.id, dates: [D1, D2] })),
        )

        expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201, 201])
        expect(await rowCount(bookingsTable)).toBe(6)
    })

    it("many dates at once: 6 users race for 31 days of the same seat; still exactly one winner", async () => {
        const { seat, slot } = await setupWorld()
        const tokens = await manyUsers(6)
        const dates = Array.from({ length: 31 }, (_, i) => futureDate(i + 1))

        const results = await Promise.all(
            tokens.map((token) => postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates })),
        )

        expect(results.filter((r) => r.status === 201)).toHaveLength(1)
        expect(results.some((r) => r.status >= 500)).toBe(false)
        expect(await rowCount(bookingsTable)).toBe(1)
        expect(await rowCount(bookingItemsTable)).toBe(31)
    })
})
