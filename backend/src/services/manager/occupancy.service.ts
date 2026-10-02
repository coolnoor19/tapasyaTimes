import { and, between, count, eq, sql } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
    bookingItemsTable as items,
    bookingsTable as bookings,
    seatsTable,
    timeSlotsTable,
} from "../../db/schema.js"
import { MAX_BOOKING_DATES } from "../../config/booking.js"
import { addDays, daysBetween, getBusinessNow } from "../../utils/businessTime.js"
import { BadRequestError } from "../../utils/errors/BadRequestError.js"
import { occupyingItemCondition } from "../availability.service.js"

const SEAT_TYPES = ["EXECUTIVE", "PROFESSIONAL", "STUDY"] as const
type SeatType = (typeof SEAT_TYPES)[number]

const DEFAULT_RANGE_DAYS = 7

const percent = (booked: number, capacity: number) => (capacity === 0 ? 0 : Math.round((booked / capacity) * 1000) / 10)

// How full the space is, day by day.
//
// capacity = seats in service x active time slots (one unit = one seat for one slot on one day)
// booked   = units of that capacity that are paid, or held with the payment window still open
//
// Capacity is today's configuration applied to every day in the range: the system does not keep a
// history of seat or slot changes, so a past day is measured against the current setup.
export async function getOccupancy(range: { from?: string | undefined; to?: string | undefined }, now: Date = new Date()) {
    const from = range.from ?? getBusinessNow(now).date
    const to = range.to ?? addDays(from, DEFAULT_RANGE_DAYS - 1)

    // The validator cannot check this when only one end was sent (the other defaults to "today").
    if (to < from) throw new BadRequestError("to: to must not be before from")
    if (daysBetween(from, to) >= MAX_BOOKING_DATES) {
        throw new BadRequestError(`to: The range may cover at most ${MAX_BOOKING_DATES} days`)
    }

    const [[slotRow], seatRows, bookedRows] = await Promise.all([
        db.select({ total: count() }).from(timeSlotsTable).where(eq(timeSlotsTable.isActive, true)),
        db
            .select({ seatType: seatsTable.seatType, total: count() })
            .from(seatsTable)
            .where(eq(seatsTable.status, "AVAILABLE"))
            .groupBy(seatsTable.seatType),
        db
            .select({
                date: sql<string>`${items.bookingDate}::text`,
                seatType: seatsTable.seatType,
                total: count(),
            })
            .from(items)
            .innerJoin(bookings, eq(bookings.id, items.bookingId))
            .innerJoin(seatsTable, eq(seatsTable.id, items.seatId))
            .innerJoin(timeSlotsTable, eq(timeSlotsTable.id, items.timeSlotId))
            .where(
                and(
                    between(items.bookingDate, from, to),
                    occupyingItemCondition(now),
                    // Only units that count towards capacity, so a day can never exceed 100%.
                    eq(seatsTable.status, "AVAILABLE"),
                    eq(timeSlotsTable.isActive, true),
                ),
            )
            .groupBy(items.bookingDate, seatsTable.seatType),
    ])

    const slotCount = slotRow?.total ?? 0
    const capacityByType = Object.fromEntries(SEAT_TYPES.map((type) => [type, 0])) as Record<SeatType, number>
    for (const row of seatRows) capacityByType[row.seatType] = row.total * slotCount

    const bookedByDay = new Map<string, Record<SeatType, number>>()
    for (const row of bookedRows) {
        const day = bookedByDay.get(row.date) ?? ({ EXECUTIVE: 0, PROFESSIONAL: 0, STUDY: 0 } as Record<SeatType, number>)
        day[row.seatType] = row.total
        bookedByDay.set(row.date, day)
    }

    const capacity = SEAT_TYPES.reduce((sum, type) => sum + capacityByType[type], 0)

    const days = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => {
        const date = addDays(from, i)
        const bookedByType = bookedByDay.get(date) ?? { EXECUTIVE: 0, PROFESSIONAL: 0, STUDY: 0 }
        const booked = SEAT_TYPES.reduce((sum, type) => sum + bookedByType[type], 0)
        return {
            date,
            capacity,
            booked,
            occupancyPercent: percent(booked, capacity),
            bySeatType: Object.fromEntries(
                SEAT_TYPES.map((type) => [
                    type,
                    {
                        capacity: capacityByType[type],
                        booked: bookedByType[type],
                        occupancyPercent: percent(bookedByType[type], capacityByType[type]),
                    },
                ]),
            ),
        }
    })

    const totalBooked = days.reduce((sum, day) => sum + day.booked, 0)
    const totalCapacity = capacity * days.length
    return {
        from,
        to,
        activeTimeSlots: slotCount,
        summary: { capacity: totalCapacity, booked: totalBooked, occupancyPercent: percent(totalBooked, totalCapacity) },
        days,
    }
}
