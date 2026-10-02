import { describe, expect, it } from "vitest"
import { MAX_BOOKING_DATES, HOLD_MINUTES } from "../../src/config/booking.js"
import { calculateItemAmountPaise } from "../../src/services/pricing.js"
import { generateBookingCode } from "../../src/utils/bookingCode.js"
import { getPgErrorCode } from "../../src/utils/dbErrors.js"
import { ConflictError } from "../../src/utils/errors/ConflictError.js"
import {
    bookingIdParamSchema,
    createBookingSchema,
    idempotencyKeySchema,
    listBookingsQuerySchema,
} from "../../src/validators/booking.validator.js"

const UUID = "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"
const valid = { seatId: UUID, timeSlotId: UUID, dates: ["2026-08-11", "2026-08-12"] }

describe("agreed booking settings", () => {
    it("holds an unpaid booking for 10 minutes", () => expect(HOLD_MINUTES).toBe(10))
    it("allows at most 31 dates", () => expect(MAX_BOOKING_DATES).toBe(31))
})

describe("generateBookingCode", () => {
    it("looks like TT- plus 8 unambiguous characters", () => {
        for (let i = 0; i < 500; i++) expect(generateBookingCode()).toMatch(/^TT-[0-9A-HJKMNP-TV-Z]{8}$/)
    })

    it("never uses look-alike letters (I, L, O, U)", () => {
        const all = Array.from({ length: 2000 }, generateBookingCode).join("")
        expect(all.replace(/TT-/g, "")).not.toMatch(/[ILOU]/)
    })

    it("does not repeat (random, not sequential)", () => {
        const codes = new Set(Array.from({ length: 10_000 }, generateBookingCode))
        expect(codes.size).toBe(10_000)
    })

    it("fits the database column (20 characters)", () => {
        expect(generateBookingCode().length).toBeLessThanOrEqual(20)
    })
})

describe("calculateItemAmountPaise", () => {
    it("a one-hour slot costs exactly the hourly price", () => {
        expect(calculateItemAmountPaise(15000, "10:00:00", "11:00:00")).toBe(15000)
    })

    it("pro-rates other slot lengths", () => {
        expect(calculateItemAmountPaise(10000, "10:00:00", "11:30:00")).toBe(15000)
        expect(calculateItemAmountPaise(10000, "10:00:00", "10:30:00")).toBe(5000)
        expect(calculateItemAmountPaise(10000, "09:00", "11:00")).toBe(20000)
    })

    it("always returns a whole number of paise", () => {
        expect(Number.isInteger(calculateItemAmountPaise(10001, "10:00:00", "10:20:00"))).toBe(true)
        expect(calculateItemAmountPaise(10001, "10:00:00", "10:20:00")).toBe(3334)
    })

    it("a free seat costs nothing", () => {
        expect(calculateItemAmountPaise(0, "10:00:00", "11:00:00")).toBe(0)
    })
})

describe("createBookingSchema", () => {
    it("accepts seat, slot and dates", () => {
        expect(createBookingSchema.safeParse(valid).success).toBe(true)
    })

    it("drops anything the client should not decide (price, status, owner)", () => {
        const result = createBookingSchema.parse({
            ...valid,
            totalAmountPaise: 1,
            amountPaise: 1,
            status: "CONFIRMED",
            userId: "someone-else",
        })
        expect(Object.keys(result).sort()).toEqual(["dates", "seatId", "timeSlotId"])
    })

    it.each([
        ["no seat", { ...valid, seatId: undefined }],
        ["bad seat id", { ...valid, seatId: "A01" }],
        ["no slot", { ...valid, timeSlotId: undefined }],
        ["no dates", { ...valid, dates: undefined }],
        ["empty dates", { ...valid, dates: [] }],
        ["a comma string instead of a list", { ...valid, dates: "2026-08-11,2026-08-12" }],
        ["duplicate dates", { ...valid, dates: ["2026-08-11", "2026-08-11"] }],
        ["an impossible date", { ...valid, dates: ["2026-02-30"] }],
        ["a bad format", { ...valid, dates: ["11/08/2026"] }],
        ["too many dates", { ...valid, dates: Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)) }],
    ])("rejects %s", (_label, body) => {
        expect(createBookingSchema.safeParse(body).success).toBe(false)
    })
})

describe("idempotencyKeySchema", () => {
    it.each(["abcdefgh", "a-b_c-1234567890", "x".repeat(100), "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"])("accepts %s", (key) => {
        expect(idempotencyKeySchema.safeParse(key).success).toBe(true)
    })

    it.each(["short", "has spaces in it", "x".repeat(101), "emoji-😀-key-here", "semi;colon-key-1", ""])("rejects %j", (key) => {
        expect(idempotencyKeySchema.safeParse(key).success).toBe(false)
    })
})

describe("bookingIdParamSchema / listBookingsQuerySchema", () => {
    it("only accepts a UUID as an id", () => {
        expect(bookingIdParamSchema.safeParse({ id: UUID }).success).toBe(true)
        expect(bookingIdParamSchema.safeParse({ id: "1" }).success).toBe(false)
        expect(bookingIdParamSchema.safeParse({ id: "1' OR '1'='1" }).success).toBe(false)
    })

    it("defaults to page 1, 20 per page", () => {
        expect(listBookingsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
    })

    it("reads numbers from the query string", () => {
        expect(listBookingsQuerySchema.parse({ page: "3", limit: "50" })).toEqual({ page: 3, limit: 50 })
    })

    it.each([{ page: "0" }, { page: "-1" }, { page: "abc" }, { page: "1.5" }, { limit: "0" }, { limit: "51" }, { limit: "1000" }])(
        "rejects %j",
        (query) => {
            expect(listBookingsQuerySchema.safeParse(query).success).toBe(false)
        },
    )
})

describe("error helpers", () => {
    it("ConflictError carries a code and structured details for the client", () => {
        const error = new ConflictError("taken", "SEAT_TAKEN", { conflictingDates: ["2026-08-13"] })
        expect(error).toMatchObject({ statusCode: 409, code: "SEAT_TAKEN", details: { conflictingDates: ["2026-08-13"] } })
    })

    it("getPgErrorCode finds the code through Drizzle's wrapper", () => {
        expect(getPgErrorCode({ cause: { code: "40P01" } })).toBe("40P01")
        expect(getPgErrorCode(new Error("plain"))).toBeUndefined()
    })
})
