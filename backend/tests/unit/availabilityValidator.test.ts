import { describe, expect, it } from "vitest"
import { MAX_BOOKING_DATES } from "../../src/config/booking.js"
import { availabilityQuerySchema } from "../../src/validators/availability.validator.js"

const SLOT = "3f8c1f0e-7b1a-4c52-9d3e-0a1b2c3d4e5f"

const parse = (query: unknown) => availabilityQuerySchema.safeParse(query)

describe("availability query validation", () => {
    describe("dates", () => {
        it("accepts a comma-separated list", () => {
            const result = parse({ dates: "2026-08-11,2026-08-12,2026-08-13", timeSlotId: SLOT })
            expect(result.success && result.data.dates).toEqual(["2026-08-11", "2026-08-12", "2026-08-13"])
        })

        it("accepts repeated query parameters (an array)", () => {
            const result = parse({ dates: ["2026-08-11", "2026-08-12"], timeSlotId: SLOT })
            expect(result.success && result.data.dates).toEqual(["2026-08-11", "2026-08-12"])
        })

        it("accepts a single date", () => {
            expect(parse({ dates: "2026-08-11", timeSlotId: SLOT }).success).toBe(true)
        })

        it("accepts non-consecutive dates in any order", () => {
            const result = parse({ dates: "2026-08-20,2026-08-11", timeSlotId: SLOT })
            expect(result.success && result.data.dates).toEqual(["2026-08-20", "2026-08-11"])
        })

        it("trims spaces around dates", () => {
            const result = parse({ dates: "2026-08-11, 2026-08-12", timeSlotId: SLOT })
            expect(result.success && result.data.dates).toEqual(["2026-08-11", "2026-08-12"])
        })

        it("accepts a leap day in a leap year", () => {
            expect(parse({ dates: "2028-02-29", timeSlotId: SLOT }).success).toBe(true)
        })

        it.each([
            ["missing", undefined],
            ["empty", ""],
            ["an empty entry in the list", "2026-08-11,,2026-08-12"],
            ["a wrong format", "11-08-2026"],
            ["an impossible date", "2026-02-30"],
            ["a leap day in a non-leap year", "2027-02-29"],
            ["a time instead of a date", "2026-08-11T10:00:00Z"],
            ["text", "tomorrow"],
            ["SQL injection", "2026-08-11'; DROP TABLE seats;--"],
        ])("rejects %s", (_label, dates) => {
            expect(parse({ dates, timeSlotId: SLOT }).success).toBe(false)
        })

        it("rejects duplicate dates", () => {
            const result = parse({ dates: "2026-08-11,2026-08-11,2026-08-12", timeSlotId: SLOT })
            expect(result.success).toBe(false)
            expect(result.error?.issues[0]?.message).toBe("Dates must not repeat")
        })

        it("rejects duplicates even when spread across repeated parameters", () => {
            expect(parse({ dates: ["2026-08-11", "2026-08-11"], timeSlotId: SLOT }).success).toBe(false)
        })

        it(`allows exactly ${MAX_BOOKING_DATES} dates but not one more`, () => {
            const days = (n: number) =>
                Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10)).join(",")
            expect(parse({ dates: days(MAX_BOOKING_DATES), timeSlotId: SLOT }).success).toBe(true)
            const tooMany = parse({ dates: days(MAX_BOOKING_DATES + 1), timeSlotId: SLOT })
            expect(tooMany.success).toBe(false)
            expect(tooMany.error?.issues[0]?.message).toContain(String(MAX_BOOKING_DATES))
        })

        it("rejects a huge list quickly instead of processing it", () => {
            const many = Array.from({ length: 5000 }, (_, i) => `2026-01-${i}`).join(",")
            expect(parse({ dates: many, timeSlotId: SLOT }).success).toBe(false)
        })

        it("rejects an object (e.g. ?dates[a]=b)", () => {
            expect(parse({ dates: { a: "2026-08-11" }, timeSlotId: SLOT }).success).toBe(false)
        })
    })

    describe("timeSlotId", () => {
        it.each([["missing", undefined], ["not a uuid", "10-11"], ["empty", ""], ["a number", 5]])(
            "rejects %s",
            (_label, timeSlotId) => {
                expect(parse({ dates: "2026-08-11", timeSlotId }).success).toBe(false)
            },
        )

        it("names the failing field in the error", () => {
            const result = parse({ dates: "2026-08-11", timeSlotId: "bad" })
            expect(result.error?.issues[0]?.path).toEqual(["timeSlotId"])
        })
    })
})
