import { describe, expect, it } from "vitest"
import { getBusinessNow, isValidCalendarDate } from "../../src/utils/businessTime.js"
import { assertDatesBookable } from "../../src/services/bookingRules.js"

describe("getBusinessNow (India time, UTC+5:30)", () => {
    it("converts a UTC moment to the Indian date and time", () => {
        expect(getBusinessNow(new Date("2026-08-11T04:30:00Z"))).toEqual({ date: "2026-08-11", time: "10:00:00" })
    })

    it("is already the NEXT day in India while it is still evening in UTC", () => {
        // 20:00 UTC on the 10th = 01:30 on the 11th in India
        expect(getBusinessNow(new Date("2026-08-10T20:00:00Z"))).toEqual({ date: "2026-08-11", time: "01:30:00" })
    })

    it("flips to the next day exactly at 18:30 UTC (midnight IST)", () => {
        expect(getBusinessNow(new Date("2026-08-10T18:29:59Z"))).toEqual({ date: "2026-08-10", time: "23:59:59" })
        expect(getBusinessNow(new Date("2026-08-10T18:30:00Z"))).toEqual({ date: "2026-08-11", time: "00:00:00" })
    })

    it("writes midnight as 00, never 24", () => {
        expect(getBusinessNow(new Date("2026-08-10T18:30:00Z")).time.startsWith("00:")).toBe(true)
    })

    it("handles the New Year boundary", () => {
        expect(getBusinessNow(new Date("2026-12-31T18:30:00Z")).date).toBe("2027-01-01")
    })

    it("uses the current moment when no argument is given", () => {
        expect(getBusinessNow().date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
})

describe("isValidCalendarDate", () => {
    it.each(["2026-08-11", "2028-02-29", "2026-12-31", "2026-01-01"])("accepts %s", (value) => {
        expect(isValidCalendarDate(value)).toBe(true)
    })

    it.each([
        "2026-02-30", // no 30th of February
        "2027-02-29", // 2027 is not a leap year
        "2026-13-01",
        "2026-00-10",
        "2026-04-31",
        "2026-8-11", // not zero-padded
        "11-08-2026",
        "2026-08-11T00:00:00Z",
        "",
        "not a date",
    ])("rejects %j", (value) => {
        expect(isValidCalendarDate(value)).toBe(false)
    })
})

describe("assertDatesBookable (past dates and started slots)", () => {
    // 11:00 AM on 11 Aug 2026, India time
    const now = new Date("2026-08-11T05:30:00Z")

    it("allows future dates for any slot", () => {
        expect(() => assertDatesBookable(["2026-08-12", "2026-09-01"], "09:00:00", now)).not.toThrow()
    })

    it("rejects any date before today and lists them", () => {
        expect(() => assertDatesBookable(["2026-08-10", "2026-08-12"], "15:00:00", now)).toThrow(/2026-08-10/)
        expect(() => assertDatesBookable(["2026-08-09", "2026-08-10"], "15:00:00", now)).toThrow(/2026-08-09, 2026-08-10/)
    })

    it("allows today for a slot that has not started yet", () => {
        expect(() => assertDatesBookable(["2026-08-11"], "12:00:00", now)).not.toThrow()
    })

    it("rejects today for a slot that already started", () => {
        expect(() => assertDatesBookable(["2026-08-11"], "09:00:00", now)).toThrow("already started")
    })

    it("treats a slot starting exactly now as started", () => {
        expect(() => assertDatesBookable(["2026-08-11"], "11:00:00", now)).toThrow("already started")
    })

    it("only applies the started-slot rule to today, not to later dates", () => {
        expect(() => assertDatesBookable(["2026-08-12"], "09:00:00", now)).not.toThrow()
    })

    it("judges 'today' in India time, not UTC (00:15 IST on the 11th is still the 10th in UTC)", () => {
        const justAfterMidnightIST = new Date("2026-08-10T18:45:00Z")
        expect(() => assertDatesBookable(["2026-08-10"], "20:00:00", justAfterMidnightIST)).toThrow(/past/)
        expect(() => assertDatesBookable(["2026-08-11"], "09:00:00", justAfterMidnightIST)).not.toThrow()
    })

    it("a slot at 09:00 is still bookable at 23:59 IST the evening before", () => {
        const lateEvening = new Date("2026-08-10T18:29:00Z") // 23:59 IST on the 10th
        expect(() => assertDatesBookable(["2026-08-11"], "09:00:00", lateEvening)).not.toThrow()
    })
})
