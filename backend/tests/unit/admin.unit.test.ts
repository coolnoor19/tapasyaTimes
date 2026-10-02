import { describe, expect, it } from "vitest"
import { blockedByBookings, changedFields } from "../../src/services/admin/diff.js"
import {
    createSeatSchema,
    createTimeSlotSchema,
    listUsersQuerySchema,
    MAX_PRICE_PAISE,
    MIN_PRICE_PAISE,
    seatTypeParamSchema,
    updatePriceSchema,
    updateSeatSchema,
    updateTimeSlotSchema,
    updateUserRoleSchema,
    updateUserStatusSchema,
} from "../../src/validators/admin.validator.js"

describe("changedFields", () => {
    const seat = { seatNumber: "A01", floor: 1, status: "AVAILABLE" }

    it("returns only the fields that really change, with their old values", () => {
        const { changes, before } = changedFields(seat, { seatNumber: "A02", floor: 1, status: "MAINTENANCE" })
        expect(changes).toEqual({ seatNumber: "A02", status: "MAINTENANCE" })
        expect(before).toEqual({ seatNumber: "A01", status: "AVAILABLE" })
    })

    it("returns nothing when the request changes nothing", () => {
        expect(changedFields(seat, { seatNumber: "A01", floor: 1 }).changes).toEqual({})
        expect(changedFields(seat, {}).changes).toEqual({})
    })

    it("ignores fields that were not sent (undefined) and treats false/0 as real values", () => {
        expect(changedFields({ isActive: true, floor: 3 }, { isActive: undefined }).changes).toEqual({})
        expect(changedFields({ isActive: true, floor: 3 }, { isActive: false, floor: 0 }).changes).toEqual({ isActive: false, floor: 0 })
    })
})

describe("blockedByBookings", () => {
    const upcoming = {
        total: 25,
        bookings: Array.from({ length: 20 }, (_, i) => ({
            bookingCode: `TT-${i}`, date: "2026-10-05", timeSlot: "10:00 - 11:00", seatNumber: "A01", status: "CONFIRMED",
        })),
    }

    it("is a 409 carrying the code, the total and the bookings in the way", () => {
        const error = blockedByBookings("SEAT_HAS_BOOKINGS", "Seat A01", upcoming)
        expect(error).toMatchObject({ statusCode: 409, code: "SEAT_HAS_BOOKINGS" })
        expect(error.details).toMatchObject({ total: 25 })
        expect((error.details!.bookings as unknown[]).length).toBe(20)
    })

    it("says when only the first few are shown", () => {
        expect(blockedByBookings("X", "Seat A01", upcoming).message).toContain("showing the first 20")
        expect(blockedByBookings("X", "Seat A01", { ...upcoming, total: 20 }).message).not.toContain("showing")
    })
})

describe("seat validation", () => {
    it("normalises the seat number (trim + uppercase)", () => {
        expect(createSeatSchema.parse({ seatNumber: "  a12 ", seatType: "STUDY", floor: 1 }).seatNumber).toBe("A12")
    })

    it.each([
        ["empty number", { seatNumber: "", seatType: "STUDY", floor: 1 }],
        ["number too long", { seatNumber: "ABCDEFGHIJK", seatType: "STUDY", floor: 1 }],
        ["number with a space inside", { seatNumber: "A 1", seatType: "STUDY", floor: 1 }],
        ["number with SQL characters", { seatNumber: "A1';--", seatType: "STUDY", floor: 1 }],
        ["unknown category", { seatNumber: "A1", seatType: "VIP", floor: 1 }],
        ["negative floor", { seatNumber: "A1", seatType: "STUDY", floor: -1 }],
        ["fractional floor", { seatNumber: "A1", seatType: "STUDY", floor: 1.5 }],
        ["floor as text", { seatNumber: "A1", seatType: "STUDY", floor: "1" }],
        ["floor above 100", { seatNumber: "A1", seatType: "STUDY", floor: 101 }],
        ["missing floor", { seatNumber: "A1", seatType: "STUDY" }],
    ])("rejects %s", (_label, body) => {
        expect(createSeatSchema.safeParse(body).success).toBe(false)
    })

    it("an update needs at least one field and only knows the four editable ones", () => {
        expect(updateSeatSchema.safeParse({}).success).toBe(false)
        expect(updateSeatSchema.safeParse({ status: "MAINTENANCE" }).success).toBe(true)
        expect(updateSeatSchema.safeParse({ status: "BOOKED" }).success).toBe(false)
        expect(Object.keys(updateSeatSchema.parse({ floor: 2, id: "x", createdAt: "x" }))).toEqual(["floor"])
    })
})

describe("time slot validation", () => {
    it.each(["00:00", "09:30", "23:59"])("accepts %s", (t) => {
        expect(createTimeSlotSchema.safeParse({ startTime: "00:00", endTime: t === "00:00" ? "00:01" : t }).success).toBe(true)
    })

    it.each([
        ["25:00 as a time", { startTime: "09:00", endTime: "25:00" }],
        ["9:00 without a leading zero", { startTime: "9:00", endTime: "10:00" }],
        ["seconds included", { startTime: "09:00:00", endTime: "10:00" }],
        ["text", { startTime: "nine", endTime: "ten" }],
        ["end equal to start", { startTime: "10:00", endTime: "10:00" }],
        ["end before start", { startTime: "11:00", endTime: "10:00" }],
        ["a blank name", { startTime: "09:00", endTime: "10:00", displayName: "   " }],
        ["a name over 50 characters", { startTime: "09:00", endTime: "10:00", displayName: "x".repeat(51) }],
    ])("rejects %s", (_label, body) => {
        expect(createTimeSlotSchema.safeParse(body).success).toBe(false)
    })

    it("an update needs at least one field; isActive must be a real boolean", () => {
        expect(updateTimeSlotSchema.safeParse({}).success).toBe(false)
        expect(updateTimeSlotSchema.safeParse({ isActive: false }).success).toBe(true)
        expect(updateTimeSlotSchema.safeParse({ isActive: "false" }).success).toBe(false)
    })
})

describe("price validation", () => {
    it("accepts whole paise between the minimum and the maximum", () => {
        for (const value of [MIN_PRICE_PAISE, 15000, MAX_PRICE_PAISE]) {
            expect(updatePriceSchema.safeParse({ pricePerHourPaise: value }).success).toBe(true)
        }
    })

    it.each([
        ["zero (a free seat could never be paid for)", 0],
        ["below the minimum", MIN_PRICE_PAISE - 1],
        ["negative", -100],
        ["above the maximum (would overflow a booking total)", MAX_PRICE_PAISE + 1],
        ["fractional", 150.5],
        ["text", "15000"],
        ["not a number", Number.NaN],
        ["a value that overflows 32 bits", 3_000_000_000],
    ])("rejects %s", (_label, value) => {
        expect(updatePriceSchema.safeParse({ pricePerHourPaise: value }).success).toBe(false)
    })

    it("the maximum price for 31 dates still fits the database's 32-bit total", () => {
        expect(MAX_PRICE_PAISE * 31).toBeLessThan(2_147_483_647)
    })

    it("only knows the three seat categories in the URL", () => {
        expect(seatTypeParamSchema.safeParse({ seatType: "STUDY" }).success).toBe(true)
        expect(seatTypeParamSchema.safeParse({ seatType: "study" }).success).toBe(false)
    })
})

describe("user validation", () => {
    it("a role can only be USER or MANAGER: admins are created by the seed script only", () => {
        expect(updateUserRoleSchema.safeParse({ role: "MANAGER" }).success).toBe(true)
        expect(updateUserRoleSchema.safeParse({ role: "USER" }).success).toBe(true)
        expect(updateUserRoleSchema.safeParse({ role: "ADMIN" }).success).toBe(false)
        expect(updateUserRoleSchema.safeParse({}).success).toBe(false)
    })

    it("a status can only be ACTIVE or SUSPENDED", () => {
        expect(updateUserStatusSchema.safeParse({ status: "SUSPENDED" }).success).toBe(true)
        expect(updateUserStatusSchema.safeParse({ status: "DELETED" }).success).toBe(false)
    })

    it("the list query has sensible defaults and limits", () => {
        expect(listUsersQuerySchema.parse({})).toEqual({ page: 1, limit: 20 })
        expect(listUsersQuerySchema.parse({ isVerified: "false", role: "MANAGER" })).toMatchObject({ isVerified: false, role: "MANAGER" })
        expect(listUsersQuerySchema.safeParse({ search: "a" }).success).toBe(false)
        expect(listUsersQuerySchema.safeParse({ search: "x".repeat(101) }).success).toBe(false)
        expect(listUsersQuerySchema.safeParse({ limit: "500" }).success).toBe(false)
        expect(listUsersQuerySchema.safeParse({ role: "SUPERUSER" }).success).toBe(false)
        expect(listUsersQuerySchema.safeParse({ isVerified: "maybe" }).success).toBe(false)
    })
})
