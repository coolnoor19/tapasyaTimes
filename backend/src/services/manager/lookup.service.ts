import { and, count, desc, eq, exists, ilike, inArray, or, sql, type SQL } from "drizzle-orm"
import { db } from "../../db/index.js"
import { bookingItemsTable as items, bookingsTable as bookings, usersTable as users } from "../../db/schema.js"
import { NotFoundError } from "../../utils/errors/NotFoundError.js"
import { escapeLike } from "../../utils/sqlLike.js"
import { toBookingView, type BookingRow } from "../booking.service.js"

type BookingStatus = typeof bookings.$inferSelect.status

export interface BookingFilters {
    code?: string | undefined
    status?: BookingStatus | undefined
    date?: string | undefined
    seatId?: string | undefined
    timeSlotId?: string | undefined
    customerId?: string | undefined
    search?: string | undefined
}

// Name, e-mail or phone contains the text (also "first last" together). Wildcards typed by the user are literal.
function customerMatches(text: string): SQL | undefined {
    const pattern = `%${escapeLike(text)}%`
    return or(
        ilike(users.email, pattern),
        ilike(users.phone, pattern),
        ilike(users.firstName, pattern),
        ilike(users.lastName, pattern),
        ilike(sql`${users.firstName} || ' ' || ${users.lastName}`, pattern),
    )
}

// A booking as staff see it: with the customer, and `holdExpired` so an unpaid booking whose seat was
// already given back is not mistaken for one that still holds it.
function toManagerBooking(row: BookingRow, now: Date) {
    return {
        ...toBookingView(row, true),
        holdExpired: row.status === "PENDING" && row.expiresAt !== null && row.expiresAt <= now,
    }
}

const withRelations = { items: { with: { seat: true, timeSlot: true } }, user: true } as const

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

export async function searchBookings(filters: BookingFilters, page: number, limit: number, now: Date = new Date()) {
    // seat / slot / date describe the booking's items, so they must all match the SAME item.
    const itemConditions = [
        filters.seatId ? eq(items.seatId, filters.seatId) : undefined,
        filters.timeSlotId ? eq(items.timeSlotId, filters.timeSlotId) : undefined,
        filters.date ? eq(items.bookingDate, filters.date) : undefined,
    ].filter((condition) => condition !== undefined)

    const where = and(
        filters.code ? eq(bookings.bookingCode, filters.code) : undefined,
        filters.status ? eq(bookings.status, filters.status) : undefined,
        filters.customerId ? eq(bookings.userId, filters.customerId) : undefined,
        filters.search ? customerMatches(filters.search) : undefined,
        itemConditions.length > 0
            ? exists(
                  db
                      .select({ one: sql`1` })
                      .from(items)
                      .where(and(eq(items.bookingId, bookings.id), ...itemConditions)),
              )
            : undefined,
    )

    const [idRows, [totalRow]] = await Promise.all([
        db
            .select({ id: bookings.id })
            .from(bookings)
            .innerJoin(users, eq(users.id, bookings.userId))
            .where(where)
            .orderBy(desc(bookings.createdAt), desc(bookings.id))
            .limit(limit)
            .offset((page - 1) * limit),
        db.select({ total: count() }).from(bookings).innerJoin(users, eq(users.id, bookings.userId)).where(where),
    ])

    const ids = idRows.map((row) => row.id)
    const rows = ids.length === 0 ? [] : await db.query.bookingsTable.findMany({ where: inArray(bookings.id, ids), with: withRelations })

    // The page was ordered by the first query; put the loaded bookings back in that order.
    const byId = new Map(rows.map((row) => [row.id, row]))
    const data = ids.flatMap((id) => (byId.has(id) ? [toManagerBooking(byId.get(id)!, now)] : []))

    return { data, page, limit, total: totalRow?.total ?? 0 }
}

export async function getBookingForStaff(bookingId: string, now: Date = new Date()) {
    const booking = await db.query.bookingsTable.findFirst({ where: eq(bookings.id, bookingId), with: withRelations })
    if (!booking) throw new NotFoundError("Booking not found")
    return toManagerBooking(booking, now)
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

type UserRow = typeof users.$inferSelect

// Only what staff need to help a customer. No role, lockout counters or password data.
const toCustomerView = (user: UserRow) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    isVerified: user.isVerified,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
})

// A "customer" is an ordinary account. Staff accounts (managers, admins) are not listed here, so a
// manager cannot use customer lookup to read an admin's e-mail or phone.
const isCustomer = eq(users.role, "USER")

export async function searchCustomers(filters: { search?: string | undefined }, page: number, limit: number) {
    const where = and(isCustomer, filters.search ? customerMatches(filters.search) : undefined)

    const [rows, [totalRow]] = await Promise.all([
        db
            .select()
            .from(users)
            .where(where)
            .orderBy(desc(users.createdAt), desc(users.id))
            .limit(limit)
            .offset((page - 1) * limit),
        db.select({ total: count() }).from(users).where(where),
    ])

    // One query for the whole page instead of one per customer.
    const counts =
        rows.length === 0
            ? []
            : await db
                  .select({ userId: bookings.userId, total: count() })
                  .from(bookings)
                  .where(inArray(bookings.userId, rows.map((row) => row.id)))
                  .groupBy(bookings.userId)
    const bookingCount = new Map(counts.map((row) => [row.userId, row.total]))

    return {
        data: rows.map((row) => ({ ...toCustomerView(row), bookingCount: bookingCount.get(row.id) ?? 0 })),
        page,
        limit,
        total: totalRow?.total ?? 0,
    }
}

const RECENT_BOOKINGS = 10

export async function getCustomer(userId: string, now: Date = new Date()) {
    const [user] = await db.select().from(users).where(and(eq(users.id, userId), isCustomer))
    if (!user) throw new NotFoundError("Customer not found")

    const recent = await searchBookings({ customerId: user.id }, 1, RECENT_BOOKINGS, now)
    return { ...toCustomerView(user), bookingCount: recent.total, recentBookings: recent.data }
}
