import { and, asc, count, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm"
import { db } from "../../db/index.js"
import {
    bookingItemsTable as items,
    bookingsTable as bookings,
    seatsTable,
    timeSlotsTable as slots,
} from "../../db/schema.js"
import { getBusinessNow } from "../../utils/businessTime.js"

type Executor = Pick<typeof db, "select">

// "Upcoming" = a reservation that still matters to a customer:
//  - CONFIRMED, or HELD while its payment window is open (an expired hold does not count), and
//  - on a later day, or today in a slot that has not ended yet (India time).
// Queries using this must join booking_items -> bookings and -> time_slots.
function upcomingActiveCondition(now: Date): SQL {
    const { date: today, time } = getBusinessNow(now)
    return and(
        or(
            eq(items.status, "CONFIRMED"),
            and(eq(items.status, "HELD"), or(isNull(bookings.expiresAt), gt(bookings.expiresAt, now))),
        ),
        or(gt(items.bookingDate, today), and(eq(items.bookingDate, today), gt(slots.endTime, time))),
    )!
}

const MAX_LISTED = 20

export interface UpcomingBookings {
    total: number
    // The first few, so an admin can see what is in the way
    bookings: { bookingCode: string; date: string; timeSlot: string; seatNumber: string; status: string }[]
}

// What blocks a change to a seat or a time slot (the admin must resolve these first).
export async function findUpcomingBookings(
    executor: Executor,
    target: { seatId: string } | { timeSlotId: string },
    now: Date,
): Promise<UpcomingBookings> {
    const targetCondition = "seatId" in target ? eq(items.seatId, target.seatId) : eq(items.timeSlotId, target.timeSlotId)
    const where = and(targetCondition, upcomingActiveCondition(now))

    const base = () =>
        executor
            .select({
                bookingCode: bookings.bookingCode,
                date: sql<string>`${items.bookingDate}::text`,
                timeSlot: slots.displayName,
                seatNumber: seatsTable.seatNumber,
                status: items.status,
            })
            .from(items)
            .innerJoin(bookings, eq(bookings.id, items.bookingId))
            .innerJoin(slots, eq(slots.id, items.timeSlotId))
            .innerJoin(seatsTable, eq(seatsTable.id, items.seatId))
            .where(where)

    const [list, [totalRow]] = await Promise.all([
        base().orderBy(asc(items.bookingDate), asc(bookings.bookingCode)).limit(MAX_LISTED),
        executor
            .select({ total: count() })
            .from(items)
            .innerJoin(bookings, eq(bookings.id, items.bookingId))
            .innerJoin(slots, eq(slots.id, items.timeSlotId))
            .where(where),
    ])

    return { total: totalRow?.total ?? 0, bookings: list }
}

// Number of upcoming reservations per seat / per slot, for the admin list screens.
export async function countUpcomingBy(column: "seat" | "timeSlot", now: Date): Promise<Map<string, number>> {
    const key = column === "seat" ? items.seatId : items.timeSlotId
    const rows = await db
        .select({ id: key, total: count() })
        .from(items)
        .innerJoin(bookings, eq(bookings.id, items.bookingId))
        .innerJoin(slots, eq(slots.id, items.timeSlotId))
        .where(upcomingActiveCondition(now))
        .groupBy(key)
    return new Map(rows.map((row) => [row.id, row.total]))
}
