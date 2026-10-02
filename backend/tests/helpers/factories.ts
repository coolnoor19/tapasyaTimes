import { db } from "../../src/db/index.js"
import {
    bookingItemsTable,
    bookingsTable,
    seatsTable,
    timeSlotsTable,
    usersTable,
} from "../../src/db/schema.js"

let counter = 0
const next = () => ++counter

export async function createUser(overrides: Partial<typeof usersTable.$inferInsert> = {}) {
    const n = next()
    const [user] = await db
        .insert(usersTable)
        .values({
            firstName: "Test",
            lastName: `User${n}`,
            email: `user${n}@example.com`,
            phone: `90000${String(n).padStart(5, "0")}`,
            passwordHash: "not-a-real-hash",
            ...overrides,
        })
        .returning()
    return user!
}

export async function createSeat(overrides: Partial<typeof seatsTable.$inferInsert> = {}) {
    const n = next()
    const [seat] = await db
        .insert(seatsTable)
        .values({ seatNumber: `T${n}`, seatType: "STUDY", floor: 1, ...overrides })
        .returning()
    return seat!
}

export async function createTimeSlot(overrides: Partial<typeof timeSlotsTable.$inferInsert> = {}) {
    const n = next()
    const [slot] = await db
        .insert(timeSlotsTable)
        .values({ startTime: "10:00", endTime: "11:00", displayName: `slot-${n}`, ...overrides })
        .returning()
    return slot!
}

export async function createBooking(userId: string, overrides: Partial<typeof bookingsTable.$inferInsert> = {}) {
    const n = next()
    const [booking] = await db
        .insert(bookingsTable)
        .values({ bookingCode: `TT-T${n}`, userId, totalAmountPaise: 10000, ...overrides })
        .returning()
    return booking!
}

export function itemValues(
    bookingId: string,
    seatId: string,
    timeSlotId: string,
    bookingDate: string,
    overrides: Partial<typeof bookingItemsTable.$inferInsert> = {},
) {
    return { bookingId, seatId, timeSlotId, bookingDate, amountPaise: 10000, ...overrides }
}
