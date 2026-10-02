import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm"
import { db } from "../db/index.js"
import {
    bookingItemsTable as items,
    bookingsTable as bookings,
    seatPricesTable,
    seatsTable,
    timeSlotsTable,
} from "../db/schema.js"
import { NotFoundError } from "../utils/errors/NotFoundError.js"
import { assertDatesBookable } from "./bookingRules.js"

export type SeatAvailability = "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "INACTIVE"

export interface AvailabilityResult {
    timeSlot: { id: string; displayName: string; startTime: string; endTime: string }
    dates: string[]
    seats: {
        id: string
        seatNumber: string
        seatType: "EXECUTIVE" | "PROFESSIONAL" | "STUDY"
        floor: number
        availability: SeatAvailability
        // Which of the requested dates are already taken (only these, never who booked)
        bookedDates: string[]
        pricePerHourPaise: number | null
    }[]
}

interface AvailabilityQuery {
    dates: string[]
    timeSlotId: string
}

// Works with the normal connection or inside a transaction.
type Executor = Pick<typeof db, "select">

// Every (seat, date) already occupied for a slot among the given dates, optionally for one seat.
// Dates are read as text so the driver cannot shift them across time zones.
// Shared by the availability screen and booking creation, so both always agree.
export async function findTakenDates(
    executor: Executor,
    opts: { timeSlotId: string; dates: string[]; seatId?: string },
    now: Date,
): Promise<{ seatId: string; bookingDate: string }[]> {
    return executor
        .select({ seatId: items.seatId, bookingDate: sql<string>`${items.bookingDate}::text` })
        .from(items)
        .innerJoin(bookings, eq(bookings.id, items.bookingId))
        .where(
            and(
                eq(items.timeSlotId, opts.timeSlotId),
                inArray(items.bookingDate, opts.dates),
                ...(opts.seatId ? [eq(items.seatId, opts.seatId)] : []),
                or(
                    eq(items.status, "CONFIRMED"),
                    // An unpaid hold only blocks the seat while its payment window is open.
                    and(eq(items.status, "HELD"), or(isNull(bookings.expiresAt), gt(bookings.expiresAt, now))),
                ),
            ),
        )
}

// A seat is selectable only if it is free on EVERY requested date for the slot.
// `now` is injectable so time rules can be tested with a fixed clock.
export async function getSeatAvailability(
    { dates, timeSlotId }: AvailabilityQuery,
    now: Date = new Date(),
): Promise<AvailabilityResult> {
    const [slot] = await db
        .select()
        .from(timeSlotsTable)
        .where(and(eq(timeSlotsTable.id, timeSlotId), eq(timeSlotsTable.isActive, true)))

    // An inactive slot looks the same as a missing one: it cannot be booked either way.
    if (!slot) throw new NotFoundError("Time slot not found")

    assertDatesBookable(dates, slot.startTime, now)

    const [allSeats, taken] = await Promise.all([
        db
            .select({
                id: seatsTable.id,
                seatNumber: seatsTable.seatNumber,
                seatType: seatsTable.seatType,
                floor: seatsTable.floor,
                status: seatsTable.status,
                pricePerHourPaise: seatPricesTable.pricePerHourPaise,
            })
            .from(seatsTable)
            .leftJoin(seatPricesTable, eq(seatPricesTable.seatType, seatsTable.seatType))
            .orderBy(asc(seatsTable.seatNumber)),

        findTakenDates(db, { timeSlotId: slot.id, dates }, now),
    ])

    const bookedBySeat = new Map<string, Set<string>>()
    for (const row of taken) {
        const set = bookedBySeat.get(row.seatId) ?? new Set<string>()
        set.add(row.bookingDate)
        bookedBySeat.set(row.seatId, set)
    }

    return {
        timeSlot: {
            id: slot.id,
            displayName: slot.displayName,
            startTime: slot.startTime.slice(0, 5),
            endTime: slot.endTime.slice(0, 5),
        },
        dates: [...dates].sort(),
        seats: allSeats.map((seat) => {
            const bookedDates = [...(bookedBySeat.get(seat.id) ?? [])].sort()
            // A seat out of service is shown as such, even if it also has bookings.
            const availability: SeatAvailability =
                seat.status !== "AVAILABLE" ? seat.status : bookedDates.length > 0 ? "BOOKED" : "AVAILABLE"
            return {
                id: seat.id,
                seatNumber: seat.seatNumber,
                seatType: seat.seatType,
                floor: seat.floor,
                availability,
                bookedDates,
                pricePerHourPaise: seat.pricePerHourPaise,
            }
        }),
    }
}
