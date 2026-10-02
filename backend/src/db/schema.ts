import { relations, sql } from "drizzle-orm"
import {
    type AnyPgColumn,
    boolean,
    check,
    date,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    time,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Conventions
// - UUID primary keys, snake_case columns in the DB (see `casing` in db/index.ts)
// - Money is stored as integer paise (Razorpay uses paise)
// - Timestamps are timestamptz; `booking_date` is a plain DATE in business
//   (Asia/Kolkata) calendar terms and is handled as a 'YYYY-MM-DD' string
// ---------------------------------------------------------------------------

const id = () => uuid().primaryKey().defaultRandom()
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
    timestamp({ withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date())

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["ADMIN", "MANAGER", "USER"])
export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED"])
export const seatTypeEnum = pgEnum("seat_type", ["EXECUTIVE", "PROFESSIONAL", "STUDY"])
export const seatStatusEnum = pgEnum("seat_status", ["AVAILABLE", "MAINTENANCE", "INACTIVE"])
export const bookingStatusEnum = pgEnum("booking_status", [
    "PENDING",
    "CONFIRMED",
    "CANCELLED",
    "COMPLETED",
    "EXPIRED",
])
// HELD = reserved while payment is pending, CONFIRMED = paid,
// RELEASED = no longer occupies the seat (cancelled / expired / failed)
export const bookingItemStatusEnum = pgEnum("booking_item_status", ["HELD", "CONFIRMED", "RELEASED"])
export const paymentStatusEnum = pgEnum("payment_status", ["CREATED", "SUCCESS", "FAILED", "REFUNDED"])
export const notificationTypeEnum = pgEnum("notification_type", [
    "BOOKING_CONFIRMED",
    "BOOKING_FAILED",
    "BOOKING_EXPIRED",
    "BOOKING_CANCELLED",
    "PAYMENT_RECEIVED",
    "PAYMENT_REFUNDED",
])
export const emailStatusEnum = pgEnum("email_status", ["PENDING", "SENT", "FAILED"])
export const verificationPurposeEnum = pgEnum("verification_purpose", [
    "EMAIL_VERIFICATION",
    "PASSWORD_RESET",
])

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const usersTable = pgTable(
    "users",
    {
        id: id(),
        firstName: varchar({ length: 100 }).notNull(),
        lastName: varchar({ length: 100 }).notNull(),
        email: varchar({ length: 255 }).notNull().unique(),
        phone: varchar({ length: 20 }).notNull().unique(),
        passwordHash: varchar({ length: 255 }).notNull(),
        profileImage: varchar({ length: 500 }),
        role: roleEnum().notNull().default("USER"),
        status: userStatusEnum().notNull().default("ACTIVE"),
        isVerified: boolean().notNull().default(false),
        // Login lockout: wrong passwords in a row, and when the lock ends.
        failedLoginAttempts: integer().notNull().default(0),
        lockedUntil: timestamp({ withTimezone: true }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [check("users_email_lowercase_chk", sql`${t.email} = lower(${t.email})`)],
)

// ---------------------------------------------------------------------------
// Seats, pricing and time slots (admin-managed configuration)
// ---------------------------------------------------------------------------

// Seat.status is the physical state of the seat only. Whether a seat is
// booked is derived from booking_items for a given date + time slot.
export const seatsTable = pgTable("seats", {
    id: id(),
    seatNumber: varchar({ length: 10 }).notNull().unique(),
    seatType: seatTypeEnum().notNull(),
    floor: integer().notNull(),
    status: seatStatusEnum().notNull().default("AVAILABLE"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
})

// One hourly price per seat category, applied to every time slot.
export const seatPricesTable = pgTable(
    "seat_prices",
    {
        seatType: seatTypeEnum().primaryKey(),
        pricePerHourPaise: integer().notNull(),
        updatedAt: updatedAt(),
    },
    (t) => [check("seat_prices_price_chk", sql`${t.pricePerHourPaise} >= 0`)],
)

export const timeSlotsTable = pgTable(
    "time_slots",
    {
        id: id(),
        startTime: time().notNull(),
        endTime: time().notNull(),
        displayName: varchar({ length: 50 }).notNull().unique(),
        isActive: boolean().notNull().default(true),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [check("time_slots_range_chk", sql`${t.endTime} > ${t.startTime}`)],
)

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

// Booking = order header. One row per checkout.
export const bookingsTable = pgTable(
    "bookings",
    {
        id: id(),
        bookingCode: varchar({ length: 20 }).notNull().unique(),
        userId: uuid()
            .notNull()
            .references(() => usersTable.id, { onDelete: "restrict" }),
        status: bookingStatusEnum().notNull().default("PENDING"),
        totalAmountPaise: integer().notNull(),
        notes: text(),
        // Deadline for payment while PENDING; the expiry job releases the seats after it.
        expiresAt: timestamp({ withTimezone: true }),
        // Client-supplied key so a retry / double-click returns the same booking.
        idempotencyKey: varchar({ length: 100 }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        unique("bookings_user_idempotency_uq").on(t.userId, t.idempotencyKey),
        index("bookings_user_created_idx").on(t.userId, t.createdAt),
        index("bookings_status_expires_idx").on(t.status, t.expiresAt),
        check("bookings_total_chk", sql`${t.totalAmountPaise} >= 0`),
    ],
)

// BookingItem = one reservable unit: one seat + one date + one time slot.
export const bookingItemsTable = pgTable(
    "booking_items",
    {
        id: id(),
        bookingId: uuid()
            .notNull()
            .references(() => bookingsTable.id, { onDelete: "restrict" }),
        seatId: uuid()
            .notNull()
            .references(() => seatsTable.id, { onDelete: "restrict" }),
        timeSlotId: uuid()
            .notNull()
            .references(() => timeSlotsTable.id, { onDelete: "restrict" }),
        bookingDate: date({ mode: "string" }).notNull(),
        // Price snapshot at booking time; later price changes do not affect it.
        amountPaise: integer().notNull(),
        status: bookingItemStatusEnum().notNull().default("HELD"),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [
        // Double-booking protection. Only HELD / CONFIRMED rows occupy a seat,
        // so releasing an item (cancel / expiry) frees the slot again.
        uniqueIndex("booking_items_active_slot_uq")
            .on(t.seatId, t.bookingDate, t.timeSlotId)
            .where(sql`${t.status} in ('HELD', 'CONFIRMED')`),
        index("booking_items_slot_date_idx").on(t.timeSlotId, t.bookingDate),
        index("booking_items_booking_idx").on(t.bookingId),
        check("booking_items_amount_chk", sql`${t.amountPaise} >= 0`),
    ],
)

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

// One payment per booking (covers all of its items).
export const paymentsTable = pgTable(
    "payments",
    {
        id: id(),
        bookingId: uuid()
            .notNull()
            .unique()
            .references(() => bookingsTable.id, { onDelete: "restrict" }),
        amountPaise: integer().notNull(),
        currency: varchar({ length: 3 }).notNull().default("INR"),
        // As reported by Razorpay (upi, card, netbanking...). Plain text on purpose:
        // the provider's list changes and an enum would break on a new value.
        method: varchar({ length: 30 }),
        razorpayOrderId: varchar({ length: 64 }).notNull().unique(),
        razorpayPaymentId: varchar({ length: 64 }).unique(),
        status: paymentStatusEnum().notNull().default("CREATED"),
        paidAt: timestamp({ withTimezone: true }),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
    },
    (t) => [check("payments_amount_chk", sql`${t.amountPaise} >= 0`)],
)

// Every webhook event is recorded once; a repeated delivery is a no-op.
export const webhookEventsTable = pgTable("webhook_events", {
    id: id(),
    eventId: varchar({ length: 100 }).notNull().unique(),
    type: varchar({ length: 100 }).notNull(),
    payload: jsonb().notNull(),
    processedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
})

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notificationsTable = pgTable(
    "notifications",
    {
        id: id(),
        userId: uuid()
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        bookingId: uuid().references(() => bookingsTable.id, { onDelete: "set null" }),
        type: notificationTypeEnum().notNull(),
        title: varchar({ length: 255 }).notNull(),
        message: text().notNull(),
        isRead: boolean().notNull().default(false),
        // Email delivery is tracked separately so a failure never affects the booking.
        emailStatus: emailStatusEnum().notNull().default("PENDING"),
        createdAt: createdAt(),
    },
    (t) => [index("notifications_user_read_idx").on(t.userId, t.isRead, t.createdAt)],
)

// ---------------------------------------------------------------------------
// Auth support tables (tokens are stored hashed, never in plain text)
// ---------------------------------------------------------------------------

export const refreshTokensTable = pgTable(
    "refresh_tokens",
    {
        id: id(),
        userId: uuid()
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        tokenHash: varchar({ length: 64 }).notNull().unique(),
        expiresAt: timestamp({ withTimezone: true }).notNull(),
        revokedAt: timestamp({ withTimezone: true }),
        // Set when this token is rotated; reuse of a replaced token signals theft.
        replacedById: uuid().references((): AnyPgColumn => refreshTokensTable.id, {
            onDelete: "set null",
        }),
        createdAt: createdAt(),
    },
    (t) => [index("refresh_tokens_user_idx").on(t.userId)],
)

export const verificationTokensTable = pgTable(
    "verification_tokens",
    {
        id: id(),
        userId: uuid()
            .notNull()
            .references(() => usersTable.id, { onDelete: "cascade" }),
        tokenHash: varchar({ length: 64 }).notNull().unique(),
        purpose: verificationPurposeEnum().notNull(),
        expiresAt: timestamp({ withTimezone: true }).notNull(),
        // Wrong-guess counter for 6-digit codes; the code is dead after too many tries.
        attempts: integer().notNull().default(0),
        usedAt: timestamp({ withTimezone: true }),
        createdAt: createdAt(),
    },
    (t) => [index("verification_tokens_user_idx").on(t.userId)],
)

// ---------------------------------------------------------------------------
// Relations (for Drizzle relational queries; the FKs above enforce integrity)
// ---------------------------------------------------------------------------

export const usersRelations = relations(usersTable, ({ many }) => ({
    bookings: many(bookingsTable),
    notifications: many(notificationsTable),
}))

export const seatsRelations = relations(seatsTable, ({ many }) => ({
    bookingItems: many(bookingItemsTable),
}))

export const timeSlotsRelations = relations(timeSlotsTable, ({ many }) => ({
    bookingItems: many(bookingItemsTable),
}))

export const bookingsRelations = relations(bookingsTable, ({ one, many }) => ({
    user: one(usersTable, { fields: [bookingsTable.userId], references: [usersTable.id] }),
    items: many(bookingItemsTable),
    payment: one(paymentsTable),
    notifications: many(notificationsTable),
}))

export const bookingItemsRelations = relations(bookingItemsTable, ({ one }) => ({
    booking: one(bookingsTable, { fields: [bookingItemsTable.bookingId], references: [bookingsTable.id] }),
    seat: one(seatsTable, { fields: [bookingItemsTable.seatId], references: [seatsTable.id] }),
    timeSlot: one(timeSlotsTable, { fields: [bookingItemsTable.timeSlotId], references: [timeSlotsTable.id] }),
}))

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
    booking: one(bookingsTable, { fields: [paymentsTable.bookingId], references: [bookingsTable.id] }),
}))

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
    user: one(usersTable, { fields: [notificationsTable.userId], references: [usersTable.id] }),
    booking: one(bookingsTable, { fields: [notificationsTable.bookingId], references: [bookingsTable.id] }),
}))
