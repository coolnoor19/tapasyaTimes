import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { count } from "drizzle-orm"
import { db } from "../../src/db/index.js"
import { bookingsTable } from "../../src/db/schema.js"
import { closeDb, hasTestDb, resetDb } from "../helpers/db.js"
import { createVerifiedUser } from "../helpers/auth.js"
import { futureDate, setupWorld } from "../helpers/booking.js"

// Booking codes are random; in the (very rare) event two collide, the booking must
// quietly retry with a new code instead of failing. A fake generator forces that here.
const codes = vi.hoisted(() => ({ queue: [] as string[] }))
vi.mock("../../src/utils/bookingCode.js", () => ({
    generateBookingCode: () => codes.queue.shift() ?? `TT-FALLBACK${Math.random().toString(36).slice(2, 5)}`.slice(0, 11),
}))

const { createBooking } = await import("../../src/services/booking.service.js")

describe.skipIf(!hasTestDb)("booking code collisions", () => {
    beforeEach(resetDb)
    afterAll(closeDb)

    it("retries with a new code when the generated one already exists", async () => {
        const { seat, slot, user } = await setupWorld()
        const other = await createVerifiedUser()
        const first = await createBooking({ userId: other.id, seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(2)] })
        codes.queue.push(first.booking.bookingCode, "TT-UNIQUE01")

        const second = await createBooking({ userId: user.id, seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(3)] })

        expect(second.booking.bookingCode).toBe("TT-UNIQUE01")
        expect((await db.select({ n: count() }).from(bookingsTable))[0]!.n).toBe(2)
    })

    it("gives up with an error (and creates nothing) if the code keeps colliding", async () => {
        const { seat, slot, user } = await setupWorld()
        const other = await createVerifiedUser()
        const first = await createBooking({ userId: other.id, seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(2)] })
        codes.queue.push(first.booking.bookingCode, first.booking.bookingCode, first.booking.bookingCode)

        await expect(
            createBooking({ userId: user.id, seatId: seat.id, timeSlotId: slot.id, dates: [futureDate(3)] }),
        ).rejects.toBeDefined()
        expect((await db.select({ n: count() }).from(bookingsTable))[0]!.n).toBe(1)
    })
})
