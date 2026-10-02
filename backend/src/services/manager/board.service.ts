import { and, asc, eq } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
    bookingItemsTable as items,
    bookingsTable as bookings,
    seatsTable,
    timeSlotsTable,
    usersTable as users,
} from "../../db/schema.js"
import { getBusinessNow } from "../../utils/businessTime.js"
import { occupyingItemCondition } from "../availability.service.js"

export type BoardSeatState = "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "INACTIVE"

// The floor view for ONE day: every time slot, and for each slot every seat with who has it.
// Read-only. `now` is injectable so the "unpaid hold has expired" rule can be tested with a fixed clock.
export async function getBoard(date: string | undefined, now: Date = new Date()) {
    const day = date ?? getBusinessNow(now).date

    const [slots, seats, occupied] = await Promise.all([
        db.select().from(timeSlotsTable).orderBy(asc(timeSlotsTable.startTime), asc(timeSlotsTable.displayName)),
        db.select().from(seatsTable).orderBy(asc(seatsTable.seatNumber)),
        db
            .select({
                seatId: items.seatId,
                timeSlotId: items.timeSlotId,
                itemStatus: items.status,
                bookingId: bookings.id,
                bookingCode: bookings.bookingCode,
                bookingStatus: bookings.status,
                expiresAt: bookings.expiresAt,
                customerId: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                phone: users.phone,
            })
            .from(items)
            .innerJoin(bookings, eq(bookings.id, items.bookingId))
            .innerJoin(users, eq(users.id, bookings.userId))
            // The same rule availability uses: an unpaid hold past its deadline is NOT shown as taken.
            .where(and(eq(items.bookingDate, day), occupyingItemCondition(now))),
    ])

    // At most one occupying item per (slot, seat, day): the database guarantees it.
    const occupant = new Map(occupied.map((row) => [`${row.timeSlotId}:${row.seatId}`, row]))
    const slotsWithBookings = new Set(occupied.map((row) => row.timeSlotId))

    // A slot an admin has switched off still shows if it has bookings that day (history stays visible).
    const shownSlots = slots.filter((slot) => slot.isActive || slotsWithBookings.has(slot.id))
    const bookableSeats = seats.filter((seat) => seat.status === "AVAILABLE").length

    const board = shownSlots.map((slot) => {
        const rows = seats.map((seat) => {
            const row = occupant.get(`${slot.id}:${seat.id}`)
            // A seat out of service shows as such, even if it still has a booking (staff must see that).
            const state: BoardSeatState = seat.status !== "AVAILABLE" ? seat.status : row ? "BOOKED" : "AVAILABLE"
            return {
                id: seat.id,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                floor: seat.floor,
                state,
                booking: row
                    ? {
                          id: row.bookingId,
                          bookingCode: row.bookingCode,
                          status: row.bookingStatus,
                          // HELD = reserved but unpaid, CONFIRMED = paid
                          itemStatus: row.itemStatus,
                          holdExpiresAt: row.itemStatus === "HELD" ? (row.expiresAt?.toISOString() ?? null) : null,
                          customer: {
                              id: row.customerId,
                              firstName: row.firstName,
                              lastName: row.lastName,
                              phone: row.phone,
                          },
                      }
                    : null,
            }
        })

        // Counted over seats that are in service only, the same denominator the occupancy report uses.
        const booked = rows.filter((row) => row.state === "BOOKED").length
        return {
            timeSlot: {
                id: slot.id,
                displayName: slot.displayName,
                startTime: slot.startTime.slice(0, 5),
                endTime: slot.endTime.slice(0, 5),
                isActive: slot.isActive,
            },
            summary: { capacity: bookableSeats, booked, available: bookableSeats - booked },
            seats: rows,
        }
    })

    return { date: day, isToday: day === getBusinessNow(now).date, slots: board }
}
