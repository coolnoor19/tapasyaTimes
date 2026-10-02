import type { Express } from "express"
import request from "supertest"
import { db } from "../../src/db/index.js"
import { bookingItemsTable, seatPricesTable } from "../../src/db/schema.js"
import { getBusinessNow } from "../../src/utils/businessTime.js"
import { signAccessToken } from "../../src/utils/token.util.js"
import { createVerifiedUser } from "./auth.js"
import { createBooking, createSeat, createTimeSlot, itemValues } from "./factories.js"

// A calendar date N days from today in India, so tests never go stale.
export function futureDate(daysAhead: number): string {
    const [year, month, day] = getBusinessNow().date.split("-").map(Number) as [number, number, number]
    return new Date(Date.UTC(year, month - 1, day + daysAhead)).toISOString().slice(0, 10)
}

export async function tokenFor(userId: string) {
    return signAccessToken(userId)
}

// A user, a 10:00-11:00 slot, an EXECUTIVE seat A01 priced at Rs 150/hour, ready to book.
export async function setupWorld(opts: { priceType?: boolean } = {}) {
    const slot = await createTimeSlot({ startTime: "10:00", endTime: "11:00", displayName: "10:00 - 11:00" })
    const seat = await createSeat({ seatNumber: "A01", seatType: "EXECUTIVE" })
    if (opts.priceType !== false) {
        await db.insert(seatPricesTable).values({ seatType: "EXECUTIVE", pricePerHourPaise: 15000 }).onConflictDoNothing()
    }
    const user = await createVerifiedUser()
    return { slot, seat, user, token: await tokenFor(user.id) }
}

export function postBooking(
    app: Express,
    token: string | undefined,
    body: unknown,
    idempotencyKey?: string,
) {
    let req = request(app).post("/api/v1/bookings")
    if (token !== undefined) req = req.set("Authorization", `Bearer ${token}`)
    if (idempotencyKey !== undefined) req = req.set("Idempotency-Key", idempotencyKey)
    return req.send(body as object)
}

// Occupies a seat directly in the database, as another customer's booking would.
export async function occupy(opts: {
    seatId: string
    slotId: string
    dates: string[]
    itemStatus?: "HELD" | "CONFIRMED" | "RELEASED"
    bookingStatus?: "PENDING" | "CONFIRMED" | "EXPIRED"
    expiresAt?: Date | null
    userId?: string
}) {
    const userId = opts.userId ?? (await createVerifiedUser()).id
    const booking = await createBooking(userId, {
        status: opts.bookingStatus ?? "CONFIRMED",
        expiresAt: opts.expiresAt ?? null,
    })
    await db
        .insert(bookingItemsTable)
        .values(opts.dates.map((d) => itemValues(booking.id, opts.seatId, opts.slotId, d, { status: opts.itemStatus ?? "CONFIRMED" })))
    return booking
}
