import { z } from "zod"
import { paginationQuerySchema } from "./common.validator.js"

const SEAT_TYPES = ["EXECUTIVE", "PROFESSIONAL", "STUDY"] as const
const SEAT_STATUSES = ["AVAILABLE", "MAINTENANCE", "INACTIVE"] as const

// Technical guards: the price column is a 32-bit integer and a booking total is
// (price x up to 31 dates), so a huge price would overflow; and Razorpay cannot
// create an order below 100 paise (Rs 1), so a lower price could never be paid.
export const MIN_PRICE_PAISE = 100
export const MAX_PRICE_PAISE = 10_000_000

const atLeastOneField = (value: object) => Object.keys(value).length > 0
const ONE_FIELD_MESSAGE = "At least one field is required"

// ---- Seats ----------------------------------------------------------------

const seatNumber = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,10}$/, "must be 1-10 characters: letters, digits or -")
const seatType = z.enum(SEAT_TYPES, "must be EXECUTIVE, PROFESSIONAL or STUDY")
const floor = z.number("must be a number").int("must be a whole number").min(0, "must be 0 or more").max(100, "must be 100 or less")

export const createSeatSchema = z.object({ seatNumber, seatType, floor })

export const updateSeatSchema = z
    .object({
        seatNumber: seatNumber.optional(),
        seatType: seatType.optional(),
        floor: floor.optional(),
        status: z.enum(SEAT_STATUSES, "must be AVAILABLE, MAINTENANCE or INACTIVE").optional(),
    })
    .refine(atLeastOneField, ONE_FIELD_MESSAGE)

export const listSeatsQuerySchema = z.object({
    status: z.enum(SEAT_STATUSES).optional(),
    seatType: z.enum(SEAT_TYPES).optional(),
})

// ---- Time slots -----------------------------------------------------------

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM in 24-hour time")
const displayName = z.string().trim().min(1, "must not be empty").max(50, "must be at most 50 characters")

export const createTimeSlotSchema = z
    .object({ startTime: time, endTime: time, displayName: displayName.optional() })
    .refine((slot) => slot.endTime > slot.startTime, { message: "endTime must be after startTime", path: ["endTime"] })

export const updateTimeSlotSchema = z
    .object({
        startTime: time.optional(),
        endTime: time.optional(),
        displayName: displayName.optional(),
        isActive: z.boolean("must be true or false").optional(),
    })
    .refine(atLeastOneField, ONE_FIELD_MESSAGE)

// ---- Prices ---------------------------------------------------------------

export const seatTypeParamSchema = z.object({
    seatType: z.enum(SEAT_TYPES, "must be EXECUTIVE, PROFESSIONAL or STUDY"),
})

export const updatePriceSchema = z.object({
    pricePerHourPaise: z
        .number("must be a number")
        .int("must be a whole number of paise")
        .min(MIN_PRICE_PAISE, `must be at least ${MIN_PRICE_PAISE} paise (Rs 1)`)
        .max(MAX_PRICE_PAISE, `must be at most ${MAX_PRICE_PAISE} paise`),
})

// ---- Users ----------------------------------------------------------------

export const listUsersQuerySchema = paginationQuerySchema.extend({
    search: z.string().trim().min(2, "must be at least 2 characters").max(100, "must be at most 100 characters").optional(),
    role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    isVerified: z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
})

export const updateUserStatusSchema = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"], "must be ACTIVE or SUSPENDED"),
})

// ADMIN is deliberately not allowed: admins are created only by the seed script.
export const updateUserRoleSchema = z.object({
    role: z.enum(["USER", "MANAGER"], "must be USER or MANAGER"),
})

// ---- Audit log ------------------------------------------------------------

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
    action: z.string().trim().min(1).max(60).optional(),
    targetType: z.string().trim().min(1).max(30).optional(),
    targetId: z.string().trim().min(1).max(64).optional(),
    actorId: z.uuid("must be a valid id").optional(),
})
