import { describe, expect, it } from "vitest"
import { addDays, daysBetween } from "../../src/utils/businessTime.js"
import { escapeLike } from "../../src/utils/sqlLike.js"
import {
    boardQuerySchema,
    managerBookingsQuerySchema,
    managerCustomersQuerySchema,
    occupancyQuerySchema,
} from "../../src/validators/manager.validator.js"

describe("addDays / daysBetween", () => {
    it.each([
        ["2026-08-11", 1, "2026-08-12"],
        ["2026-08-31", 1, "2026-09-01"], // month end
        ["2026-12-31", 1, "2027-01-01"], // year end
        ["2028-02-28", 1, "2028-02-29"], // leap day exists
        ["2027-02-28", 1, "2027-03-01"], // and does not in other years
        ["2026-03-01", -1, "2026-02-28"],
        ["2026-08-11", 0, "2026-08-11"],
        ["2026-10-25", 1, "2026-10-26"], // a daylight-saving change date in Europe: still exactly one day
    ])("addDays(%s, %i) = %s", (date, days, expected) => {
        expect(addDays(date, days)).toBe(expected)
    })

    it("daysBetween counts whole days, both directions", () => {
        expect(daysBetween("2026-08-11", "2026-08-11")).toBe(0)
        expect(daysBetween("2026-08-11", "2026-08-12")).toBe(1)
        expect(daysBetween("2026-12-25", "2027-01-05")).toBe(11)
        expect(daysBetween("2026-08-12", "2026-08-11")).toBe(-1)
        expect(daysBetween("2028-02-01", "2028-03-01")).toBe(29)
    })
})

describe("escapeLike", () => {
    it("escapes LIKE wildcards and the escape character itself", () => {
        expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\")
        expect(escapeLike("plain")).toBe("plain")
    })
})

describe("manager query validators", () => {
    it("board: date is optional, must be a real calendar day", () => {
        expect(boardQuerySchema.safeParse({}).success).toBe(true)
        expect(boardQuerySchema.safeParse({ date: "2026-08-11" }).success).toBe(true)
        for (const date of ["2026-02-30", "2026-8-1", "tomorrow", "", "0000-01-01", "2026-13-01"]) {
            expect(boardQuerySchema.safeParse({ date }).success, date).toBe(false)
        }
        expect(boardQuerySchema.safeParse({ date: ["2026-08-11", "2026-08-12"] }).success).toBe(false)
    })

    describe("occupancy range", () => {
        it("accepts a single day, and a range of exactly 31 days", () => {
            expect(occupancyQuerySchema.safeParse({ from: "2026-08-01", to: "2026-08-01" }).success).toBe(true)
            expect(occupancyQuerySchema.safeParse({ from: "2026-08-01", to: "2026-08-31" }).success).toBe(true)
        })
        it("rejects 32 days, and a range that ends before it starts", () => {
            expect(occupancyQuerySchema.safeParse({ from: "2026-08-01", to: "2026-09-01" }).success).toBe(false)
            expect(occupancyQuerySchema.safeParse({ from: "2026-08-02", to: "2026-08-01" }).success).toBe(false)
        })
        it("allows either end to be left out (the service fills the default)", () => {
            expect(occupancyQuerySchema.safeParse({}).success).toBe(true)
            expect(occupancyQuerySchema.safeParse({ from: "2026-08-01" }).success).toBe(true)
            expect(occupancyQuerySchema.safeParse({ to: "2026-08-01" }).success).toBe(true)
        })
    })

    describe("booking search", () => {
        const parse = (query: object) => managerBookingsQuerySchema.safeParse(query)

        it("normalises the booking code to upper case without spaces", () => {
            const result = parse({ code: "  tt-abcd2345 " })
            expect(result.success && result.data.code).toBe("TT-ABCD2345")
        })
        it.each([{ code: "tt abcd" }, { code: "a'b" }, { code: "X".repeat(21) }, { status: "DONE" }, { seatId: "1" }, { search: "a" }, { page: "0" }, { limit: "51" }])(
            "rejects %j",
            (query) => {
                expect(parse(query).success).toBe(false)
            },
        )
        it("applies pagination defaults", () => {
            const result = parse({})
            expect(result.success && [result.data.page, result.data.limit]).toEqual([1, 20])
        })
    })

    it("customer search needs at least 2 characters when given", () => {
        expect(managerCustomersQuerySchema.safeParse({}).success).toBe(true)
        expect(managerCustomersQuerySchema.safeParse({ search: "a" }).success).toBe(false)
        expect(managerCustomersQuerySchema.safeParse({ search: "al" }).success).toBe(true)
    })
})
