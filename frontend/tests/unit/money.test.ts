import { describe, expect, it } from "vitest";
import { formatPerHour, formatRupees } from "@/lib/money";

describe("formatRupees (paise in, text out)", () => {
  it.each([
    [0, "₹0"],
    [100, "₹1"],
    [15000, "₹150"],
    [99, "₹0.99"],
    [45050, "₹450.50"],
    [45005, "₹450.05"],
    [123456700, "₹12,34,567"], // Indian grouping: lakhs and crores
    [10000000, "₹1,00,000"],
  ])("%i paise -> %s", (paise, expected) => {
    expect(formatRupees(paise)).toBe(expected);
  });

  it("keeps the minus sign in front of the rupee symbol", () => {
    expect(formatRupees(-15000)).toBe("-₹150");
    expect(formatRupees(-50)).toBe("-₹0.50");
  });

  it("never prints NaN or Infinity", () => {
    expect(formatRupees(Number.NaN)).toBe("—");
    expect(formatRupees(Number.POSITIVE_INFINITY)).toBe("—");
  });

  it("rounds a stray fractional paisa instead of printing it", () => {
    expect(formatRupees(150.4)).toBe("₹1.50");
  });

  it("formats an hourly price", () => {
    expect(formatPerHour(15000)).toBe("₹150/hr");
  });
});
