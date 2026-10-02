import { z } from "zod"
import { dateListSchema } from "./availability.validator.js"

// Only these three fields are read. Anything else a client sends (an amount, a
// total, a status...) is dropped, because price and status are decided by the backend.
export const createBookingSchema = z.object({
    seatId: z.uuid("must be a valid id"),
    timeSlotId: z.uuid("must be a valid id"),
    dates: dateListSchema,
})

// Optional `Idempotency-Key` header: lets a client safely retry a request.
export const idempotencyKeySchema = z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,100}$/, "Idempotency-Key must be 8-100 characters: letters, digits, _ or -")

export const bookingIdParamSchema = z.object({
    id: z.uuid("must be a valid id"),
})

export const listBookingsQuerySchema = z.object({
    page: z.coerce.number().int().min(1, "must be at least 1").default(1),
    limit: z.coerce.number().int().min(1, "must be at least 1").max(50, "must be at most 50").default(20),
})
