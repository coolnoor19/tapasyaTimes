import { z } from "zod"
import { MAX_BOOKING_DATES } from "../config/booking.js"
import { isValidCalendarDate } from "../utils/businessTime.js"

const dateString = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be in YYYY-MM-DD format")
    .refine(isValidCalendarDate, "is not a real calendar date")

// Accepts both  ?dates=2026-08-11,2026-08-12  and  ?dates=2026-08-11&dates=2026-08-12
const dates = z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : [value]).flatMap((item) => item.split(",")))
    .pipe(
        z
            .array(dateString)
            .min(1, "At least one date is required")
            .max(MAX_BOOKING_DATES, `At most ${MAX_BOOKING_DATES} dates are allowed`)
            .refine((list) => new Set(list).size === list.length, "Dates must not repeat"),
    )

export const availabilityQuerySchema = z.object({
    dates,
    timeSlotId: z.uuid("must be a valid id"),
})
