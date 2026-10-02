import { z } from "zod"
import { MAX_BOOKING_DATES } from "../config/booking.js"
import { daysBetween, isValidCalendarDate } from "../utils/businessTime.js"
import { paginationQuerySchema } from "./common.validator.js"

const calendarDate = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
    .refine(isValidCalendarDate, "is not a real calendar date")

const searchText = z.string().trim().min(2, "must be at least 2 characters").max(100, "must be at most 100 characters")

// ---- Today's board ----------------------------------------------------------

// Any date is allowed (history included). When omitted, the service uses today in India.
export const boardQuerySchema = z.object({ date: calendarDate.optional() })

// ---- Occupancy ---------------------------------------------------------------

// Both ends optional: from defaults to today, to defaults to a week after `from` (decided in the service).
export const occupancyQuerySchema = z
    .object({ from: calendarDate.optional(), to: calendarDate.optional() })
    .refine((q) => !q.from || !q.to || q.to >= q.from, { message: "to must not be before from", path: ["to"] })
    .refine((q) => !q.from || !q.to || daysBetween(q.from, q.to) < MAX_BOOKING_DATES, {
        message: `The range may cover at most ${MAX_BOOKING_DATES} days`,
        path: ["to"],
    })

// ---- Booking lookup ----------------------------------------------------------

export const BOOKING_STATUSES = ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "EXPIRED"] as const

export const managerBookingsQuerySchema = paginationQuerySchema.extend({
    code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{1,20}$/, "must be a booking code such as TT-ABCD2345")
        .optional(),
    status: z.enum(BOOKING_STATUSES, `must be one of ${BOOKING_STATUSES.join(", ")}`).optional(),
    // Bookings that include this day
    date: calendarDate.optional(),
    seatId: z.uuid("must be a valid id").optional(),
    timeSlotId: z.uuid("must be a valid id").optional(),
    customerId: z.uuid("must be a valid id").optional(),
    // Customer name, email or phone
    search: searchText.optional(),
})

// ---- Customer lookup ---------------------------------------------------------

export const managerCustomersQuerySchema = paginationQuerySchema.extend({ search: searchText.optional() })
