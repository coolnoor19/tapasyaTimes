import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  expandRange,
  formatDateList,
  formatDay,
  formatDayWithYear,
  formatTime,
  todayInIndia,
} from "@/lib/dates";

describe("todayInIndia", () => {
  it("is already the next day in India while it is still evening in UTC", () => {
    // 19:00 UTC on the 10th is 00:30 IST on the 11th
    expect(todayInIndia(new Date("2026-08-10T19:00:00Z"))).toBe("2026-08-11");
  });

  it("is still the same day just before India's midnight", () => {
    // 18:29 UTC = 23:59 IST
    expect(todayInIndia(new Date("2026-08-10T18:29:00Z"))).toBe("2026-08-10");
    expect(todayInIndia(new Date("2026-08-10T18:30:00Z"))).toBe("2026-08-11");
  });

  it("crosses a year end correctly", () => {
    expect(todayInIndia(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
  });
});

describe("addDays / daysBetween", () => {
  it.each([
    ["2026-08-31", 1, "2026-09-01"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2028-02-28", 1, "2028-02-29"], // leap year
    ["2027-02-28", 1, "2027-03-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2026-08-11", 0, "2026-08-11"],
    ["2026-08-11", 31, "2026-09-11"],
  ])("addDays(%s, %i) = %s", (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it("counts whole days in both directions", () => {
    expect(daysBetween("2026-08-11", "2026-08-11")).toBe(0);
    expect(daysBetween("2026-12-25", "2027-01-05")).toBe(11);
    expect(daysBetween("2026-08-12", "2026-08-11")).toBe(-1);
  });
});

describe("expandRange", () => {
  it("lists every day, both ends included", () => {
    expect(expandRange("2026-08-30", "2026-09-02")).toEqual(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-02"]);
  });
  it("a single day is a range of one", () => {
    expect(expandRange("2026-08-11", "2026-08-11")).toEqual(["2026-08-11"]);
  });
  it("an end before the start is empty, not backwards", () => {
    expect(expandRange("2026-08-12", "2026-08-11")).toEqual([]);
  });
});

describe("formatDateList (how a person reads a list of days)", () => {
  it.each([
    [[], ""],
    [["2026-08-11"], "11 Aug"],
    [["2026-08-11", "2026-08-12", "2026-08-13"], "11–13 Aug"],
    [["2026-08-13", "2026-08-11", "2026-08-12"], "11–13 Aug"], // order does not matter
    [["2026-08-11", "2026-08-13"], "11 Aug, 13 Aug"],
    [["2026-08-30", "2026-08-31", "2026-09-01"], "30 Aug – 1 Sep"], // across a month
    [["2026-12-31", "2027-01-01"], "31 Dec – 1 Jan"], // across a year
    [["2026-08-11", "2026-08-11"], "11 Aug"], // duplicates collapse
    [["2026-08-10", "2026-08-11", "2026-08-14", "2026-08-15", "2026-08-20"], "10–11 Aug, 14–15 Aug, 20 Aug"],
  ])("%j -> %s", (dates, expected) => {
    expect(formatDateList(dates)).toBe(expected);
  });
});

describe("formatDay", () => {
  it("shows weekday, day and month, unaffected by the visitor's time zone", () => {
    expect(formatDay("2026-08-11")).toMatch(/Tue/);
    expect(formatDay("2026-08-11")).toMatch(/11/);
    expect(formatDay("2026-08-11")).toMatch(/Aug/);
  });
});

describe("formatDayWithYear", () => {
  const now = new Date("2026-08-11T05:00:00Z");
  it("leaves the year out for the current year", () => {
    expect(formatDayWithYear("2026-12-25", now)).toBe("25 Dec");
  });
  it("adds it for any other year", () => {
    expect(formatDayWithYear("2027-01-05", now)).toBe("5 Jan 2027");
  });
});

describe("formatTime (12-hour clock)", () => {
  it.each([
    ["00:00", "12:00 AM"],
    ["00:30", "12:30 AM"],
    ["09:05", "9:05 AM"],
    ["12:00", "12:00 PM"],
    ["13:05:00", "1:05 PM"],
    ["23:59", "11:59 PM"],
  ])("%s -> %s", (time, expected) => {
    expect(formatTime(time)).toBe(expected);
  });
});
