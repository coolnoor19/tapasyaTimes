import { and, count, desc, eq, inArray, lte } from "drizzle-orm"
import { db } from "../db/index.js"
import {
    bookingItemsTable as items,
    bookingsTable as bookings,
    seatPricesTable,
    seatsTable,
    timeSlotsTable,
} from "../db/schema.js"
import { HOLD_MINUTES } from "../config/booking.js"
import { generateBookingCode } from "../utils/bookingCode.js"
import { getPgErrorCode, getUniqueViolation } from "../utils/dbErrors.js"
import { AppError } from "../utils/errors/AppError.js"
import { ConflictError } from "../utils/errors/ConflictError.js"
import { NotFoundError } from "../utils/errors/NotFoundError.js"
import { findTakenDates } from "./availability.service.js"
import { assertDatesBookable } from "./bookingRules.js"
import { calculateItemAmountPaise } from "./pricing.js"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type UserRole = "ADMIN" | "MANAGER" | "USER"

export interface CreateBookingInput {
    userId: string
    seatId: string
    timeSlotId: string
    dates: string[]
    idempotencyKey?: string | undefined
}

export interface BookingView {
    id: string
    bookingCode: string
    status: string
    totalAmountPaise: number
    currency: "INR"
    expiresAt: string | null
    createdAt: string
    // One seat and one slot per booking in V1; read from its items.
    seat: { id: string; seatNumber: string; seatType: string; floor: number } | null
    timeSlot: { id: string; displayName: string; startTime: string; endTime: string } | null
    items: { id: string; date: string; amountPaise: number; status: string }[]
    // Only shown to staff (manager / admin)
    customer?: { id: string; firstName: string; lastName: string; email: string; phone: string }
}

const MAX_ATTEMPTS = 3
const ITEM_CONSTRAINT = "booking_items_active_slot_uq"
const IDEMPOTENCY_CONSTRAINT = "bookings_user_idempotency_uq"
const BOOKING_CODE_CONSTRAINT = "bookings_bookingCode_unique"

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

// Creates a PENDING booking holding the seat on every date, or nothing at all.
// `now` is injectable so time rules and hold expiry can be tested with a fixed clock.
export async function createBooking(
    input: CreateBookingInput,
    now: Date = new Date(),
): Promise<{ booking: BookingView; replayed: boolean }> {
    const dates = [...input.dates].sort()

    // A retry of a request we already handled returns the original booking.
    const replay = await findIdempotentReplay(input, dates)
    if (replay) return { booking: replay, replayed: true }

    // A request that fails because the seat is taken may in fact be a retry of a request that
    // JUST succeeded (both started before either committed). With an Idempotency-Key, answer
    // with the original booking instead of a conflict.
    const replayIfRetry = async () => (input.idempotencyKey ? findIdempotentReplay(input, dates) : undefined)

    for (let attempt = 1; ; attempt++) {
        try {
            const booking = await db.transaction((tx) => runCreateTransaction(tx, input, dates, now))
            return { booking, replayed: false }
        } catch (err) {
            if (err instanceof AppError) {
                if (err.code === "SEAT_TAKEN") {
                    const raced = await replayIfRetry()
                    if (raced) return { booking: raced, replayed: true }
                }
                throw err
            }

            const retryable = attempt < MAX_ATTEMPTS

            // Two requests with the same Idempotency-Key raced: the loser returns the winner's booking.
            const unique = getUniqueViolation(err)
            if (unique?.constraint === IDEMPOTENCY_CONSTRAINT) {
                const raced = await replayIfRetry()
                if (raced) return { booking: raced, replayed: true }
            }

            // The database refused a double booking: report which dates are taken.
            if (unique?.constraint === ITEM_CONSTRAINT) {
                const raced = await replayIfRetry()
                if (raced) return { booking: raced, replayed: true }
                const conflict = await describeConflict(input, dates, now)
                if (conflict) throw conflict
                if (retryable) continue // the other booking vanished meanwhile; try again
            }

            // Rare: random booking code collided, or a deadlock / serialization failure.
            const code = getPgErrorCode(err)
            const transient = unique?.constraint === BOOKING_CODE_CONSTRAINT || code === "40P01" || code === "40001"
            if (transient && retryable) continue

            throw err
        }
    }
}

async function runCreateTransaction(tx: Tx, input: CreateBookingInput, dates: string[], now: Date): Promise<BookingView> {
    // FOR SHARE: an admin cannot change or switch off this slot until this booking commits
    // (and if they got there first, we wait for them and then see the new state).
    const [slot] = await tx
        .select()
        .from(timeSlotsTable)
        .where(and(eq(timeSlotsTable.id, input.timeSlotId), eq(timeSlotsTable.isActive, true)))
        .for("share")
    if (!slot) throw new NotFoundError("Time slot not found")

    assertDatesBookable(dates, slot.startTime, now)

    // FOR SHARE: an admin cannot put the seat into maintenance until this booking commits.
    const [seat] = await tx.select().from(seatsTable).where(eq(seatsTable.id, input.seatId)).for("share")
    if (!seat) throw new NotFoundError("Seat not found")
    if (seat.status !== "AVAILABLE") {
        throw new ConflictError(`Seat ${seat.seatNumber} is not available for booking`, "SEAT_UNAVAILABLE")
    }

    // The price is always read from the database; the client never supplies it.
    const [price] = await tx.select().from(seatPricesTable).where(eq(seatPricesTable.seatType, seat.seatType))
    if (!price) {
        throw new AppError("Pricing is not configured for this seat type", 500, "PRICING_NOT_CONFIGURED")
    }
    const amountPaise = calculateItemAmountPaise(price.pricePerHourPaise, slot.startTime, slot.endTime)

    await releaseExpiredHolds(tx, seat.id, slot.id, dates, now)

    const taken = await findTakenDates(tx, { timeSlotId: slot.id, seatId: seat.id, dates }, now)
    if (taken.length > 0) throw seatTakenError(seat.seatNumber, taken.map((row) => row.bookingDate))

    const [booking] = await tx
        .insert(bookings)
        .values({
            bookingCode: generateBookingCode(),
            userId: input.userId,
            status: "PENDING",
            totalAmountPaise: amountPaise * dates.length,
            expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
            idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning()

    // `dates` is sorted: every request takes its dates in the same order, so two
    // overlapping bookings wait for each other instead of deadlocking.
    const createdItems = await tx
        .insert(items)
        .values(
            dates.map((bookingDate) => ({
                bookingId: booking!.id,
                seatId: seat.id,
                timeSlotId: slot.id,
                bookingDate,
                amountPaise,
                status: "HELD" as const,
            })),
        )
        .returning()

    return {
        id: booking!.id,
        bookingCode: booking!.bookingCode,
        status: booking!.status,
        totalAmountPaise: booking!.totalAmountPaise,
        currency: "INR",
        expiresAt: booking!.expiresAt?.toISOString() ?? null,
        createdAt: booking!.createdAt.toISOString(),
        seat: { id: seat.id, seatNumber: seat.seatNumber, seatType: seat.seatType, floor: seat.floor },
        timeSlot: toSlotView(slot),
        items: createdItems
            .map((item) => ({ id: item.id, date: item.bookingDate, amountPaise: item.amountPaise, status: item.status }))
            .sort((a, b) => a.date.localeCompare(b.date)),
    }
}

// An abandoned unpaid booking still occupies its seat in the database until it is
// released. Availability already treats it as free once its window has passed, so
// booking creation must really release it, or the screen and the booking would disagree.
// The whole booking is expired (all its items), not just the overlapping ones.
async function releaseExpiredHolds(tx: Tx, seatId: string, timeSlotId: string, dates: string[], now: Date) {
    const stale = await tx
        .selectDistinct({ id: bookings.id })
        .from(items)
        .innerJoin(bookings, eq(bookings.id, items.bookingId))
        .where(
            and(
                eq(items.seatId, seatId),
                eq(items.timeSlotId, timeSlotId),
                inArray(items.bookingDate, dates),
                eq(items.status, "HELD"),
                eq(bookings.status, "PENDING"),
                lte(bookings.expiresAt, now),
            ),
        )
    if (stale.length === 0) return

    // Sorted ids: concurrent requests lock the same rows in the same order.
    const ids = stale.map((row) => row.id).sort()

    // Re-checked in the UPDATE itself, so a payment confirming at the same moment wins.
    const expired = await tx
        .update(bookings)
        .set({ status: "EXPIRED" })
        .where(and(inArray(bookings.id, ids), eq(bookings.status, "PENDING"), lte(bookings.expiresAt, now)))
        .returning({ id: bookings.id })
    if (expired.length === 0) return

    await tx
        .update(items)
        .set({ status: "RELEASED" })
        .where(and(inArray(items.bookingId, expired.map((row) => row.id)), eq(items.status, "HELD")))
}

const seatTakenError = (seatNumber: string, conflictingDates: string[]) =>
    new ConflictError(`Seat ${seatNumber} is not available on: ${[...conflictingDates].sort().join(", ")}`, "SEAT_TAKEN", {
        conflictingDates: [...conflictingDates].sort(),
    })

// After the database rejected an insert, find out which dates caused it.
async function describeConflict(input: CreateBookingInput, dates: string[], now: Date) {
    const taken = await findTakenDates(db, { timeSlotId: input.timeSlotId, seatId: input.seatId, dates }, now)
    if (taken.length === 0) return undefined
    const [seat] = await db.select({ seatNumber: seatsTable.seatNumber }).from(seatsTable).where(eq(seatsTable.id, input.seatId))
    return seatTakenError(seat?.seatNumber ?? "selected seat", taken.map((row) => row.bookingDate))
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

async function findIdempotentReplay(input: CreateBookingInput, dates: string[]): Promise<BookingView | undefined> {
    if (!input.idempotencyKey) return undefined

    const existing = await db.query.bookingsTable.findFirst({
        where: and(eq(bookings.userId, input.userId), eq(bookings.idempotencyKey, input.idempotencyKey)),
        with: { items: { with: { seat: true, timeSlot: true } } },
    })
    if (!existing) return undefined

    const sameRequest =
        existing.items.length === dates.length &&
        existing.items.every((item) => item.seatId === input.seatId && item.timeSlotId === input.timeSlotId) &&
        [...existing.items.map((item) => item.bookingDate)].sort().join() === dates.join()

    if (!sameRequest) {
        throw new ConflictError(
            "This Idempotency-Key was already used for a different request",
            "IDEMPOTENCY_KEY_REUSED",
        )
    }
    return toBookingView(existing)
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getBooking(bookingId: string, viewer: { id: string; role: UserRole }): Promise<BookingView> {
    const booking = await db.query.bookingsTable.findFirst({
        where: eq(bookings.id, bookingId),
        with: { items: { with: { seat: true, timeSlot: true } }, user: true },
    })

    const isStaff = viewer.role === "ADMIN" || viewer.role === "MANAGER"
    // A booking that is not yours looks exactly like one that does not exist.
    if (!booking || (!isStaff && booking.userId !== viewer.id)) {
        throw new NotFoundError("Booking not found")
    }

    return toBookingView(booking, isStaff)
}

export async function listMyBookings(userId: string, page: number, limit: number) {
    const [rows, [totalRow]] = await Promise.all([
        db.query.bookingsTable.findMany({
            where: eq(bookings.userId, userId),
            orderBy: [desc(bookings.createdAt), desc(bookings.id)],
            limit,
            offset: (page - 1) * limit,
            with: { items: { with: { seat: true, timeSlot: true } } },
        }),
        db.select({ total: count() }).from(bookings).where(eq(bookings.userId, userId)),
    ])

    return {
        data: rows.map((row) => toBookingView(row)),
        page,
        limit,
        total: totalRow?.total ?? 0,
    }
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

const toSlotView = (slot: { id: string; displayName: string; startTime: string; endTime: string }) => ({
    id: slot.id,
    displayName: slot.displayName,
    startTime: slot.startTime.slice(0, 5),
    endTime: slot.endTime.slice(0, 5),
})

type BookingRow = typeof bookings.$inferSelect & {
    items: (typeof items.$inferSelect & {
        seat: typeof seatsTable.$inferSelect
        timeSlot: typeof timeSlotsTable.$inferSelect
    })[]
    user?: { id: string; firstName: string; lastName: string; email: string; phone: string }
}

function toBookingView(row: BookingRow, includeCustomer = false): BookingView {
    const sortedItems = [...row.items].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))
    const first = sortedItems[0]

    const view: BookingView = {
        id: row.id,
        bookingCode: row.bookingCode,
        status: row.status,
        totalAmountPaise: row.totalAmountPaise,
        currency: "INR",
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        seat: first
            ? { id: first.seat.id, seatNumber: first.seat.seatNumber, seatType: first.seat.seatType, floor: first.seat.floor }
            : null,
        timeSlot: first ? toSlotView(first.timeSlot) : null,
        items: sortedItems.map((item) => ({
            id: item.id,
            date: item.bookingDate,
            amountPaise: item.amountPaise,
            status: item.status,
        })),
    }

    if (includeCustomer && row.user) {
        view.customer = {
            id: row.user.id,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            email: row.user.email,
            phone: row.user.phone,
        }
    }
    return view
}
