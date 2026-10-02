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
const [D1, D2, D3] = [2, 3, 4].map(futureDate) as [string, string, string]
const KEY = "retry-key-0001"

const rowCount = async (table: typeof bookingsTable | typeof bookingItemsTable) =>
    (await db.select({ n: count() }).from(table))[0]!.n

describe.skipIf(!hasTestDb)("Idempotency-Key (safe retries)", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("a retry with the same key returns the SAME booking instead of creating another", async () => {
        const { seat, slot, token } = await setupWorld()
        const body = { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2] }

        const first = await postBooking(app, token, body, KEY)
        const retry = await postBooking(app, token, body, KEY)

        expect(first.status).toBe(201)
        expect(retry.status).toBe(200)
        expect(retry.headers["idempotent-replayed"]).toBe("true")
        expect(first.headers["idempotent-replayed"]).toBeUndefined()
        expect(retry.body).toEqual(first.body)
        expect(await rowCount(bookingsTable)).toBe(1)
        expect(await rowCount(bookingItemsTable)).toBe(2)
    })

    it("6 identical requests sent at the same moment create exactly ONE booking", async () => {
        const { seat, slot, token } = await setupWorld()
        const body = { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2, D3] }

        const results = await Promise.all(Array.from({ length: 6 }, () => postBooking(app, token, body, KEY)))

        expect(results.filter((r) => r.status === 201)).toHaveLength(1)
        expect(results.filter((r) => r.status === 200)).toHaveLength(5)
        expect(results.some((r) => r.status >= 400)).toBe(false)
        expect(new Set(results.map((r) => r.body.id)).size).toBe(1)
        expect(await rowCount(bookingsTable)).toBe(1)
        expect(await rowCount(bookingItemsTable)).toBe(3)
    })

    it("the date order of a retry does not matter", async () => {
        const { seat, slot, token } = await setupWorld()
        const first = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1, D2, D3] }, KEY)
        const retry = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D3, D1, D2] }, KEY)
        expect(retry.status).toBe(200)
        expect(retry.body.id).toBe(first.body.id)
    })

    it("reusing a key for a DIFFERENT request is refused", async () => {
        const { seat, slot, token } = await setupWorld()
        const otherSeat = await createSeat({ seatNumber: "A02", seatType: "EXECUTIVE" })
        await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }, KEY)

        const otherDates = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D2] }, KEY)
        const otherSeatRes = await postBooking(app, token, { seatId: otherSeat.id, timeSlotId: slot.id, dates: [D1] }, KEY)

        for (const res of [otherDates, otherSeatRes]) {
            expect(res.status).toBe(409)
            expect(res.body.code).toBe("IDEMPOTENCY_KEY_REUSED")
        }
        expect(await rowCount(bookingsTable)).toBe(1)
    })

    it("two different users can use the same key independently", async () => {
        const { seat, slot, token } = await setupWorld()
        const otherSeat = await createSeat({ seatNumber: "A02", seatType: "EXECUTIVE" })
        const otherToken = await tokenFor((await createVerifiedUser()).id)

        const a = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }, KEY)
        const b = await postBooking(app, otherToken, { seatId: otherSeat.id, timeSlotId: slot.id, dates: [D1] }, KEY)

        expect([a.status, b.status]).toEqual([201, 201])
        expect(a.body.id).not.toBe(b.body.id)
    })

    it("one user can never read another user's booking through a shared key", async () => {
        const { seat, slot, token } = await setupWorld()
        const stranger = await tokenFor((await createVerifiedUser()).id)
        const mine = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }, KEY)

        const theirs = await postBooking(app, stranger, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }, KEY)

        // the stranger is told the seat is taken; they never receive the other user's booking
        expect(theirs.status).toBe(409)
        expect(JSON.stringify(theirs.body)).not.toContain(mine.body.bookingCode)
    })

    it.each(["short", "has spaces in key", "x".repeat(101), "semi;colon-in-key"])("rejects a malformed key %j with 400", async (key) => {
        const { seat, slot, token } = await setupWorld()
        const res = await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] }, key)
        expect(res.status).toBe(400)
        expect(await rowCount(bookingsTable)).toBe(0)
    })

    it("works without any key", async () => {
        const { seat, slot, token } = await setupWorld()
        expect((await postBooking(app, token, { seatId: seat.id, timeSlotId: slot.id, dates: [D1] })).status).toBe(201)
    })
})
