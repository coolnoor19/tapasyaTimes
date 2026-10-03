// The backend stores a price as whole PAISE (100 paise = Rs 1) between Rs 1 and Rs 1,00,000 an hour.
// Admins type rupees. The text is turned into paise with string maths only: 0.1 + 0.2 style float errors can never
// creep into a price (19.99 * 100 is 1998.9999999999998 in floating point).

export const MIN_PRICE_PAISE = 100;
export const MAX_PRICE_PAISE = 10_000_000;

export type PriceParse = { ok: true; paise: number } | { ok: false; error: string };

// "150" | "150.5" | "₹1,250.00" -> paise
export function parseRupees(text: string): PriceParse {
  const cleaned = text.replace(/[\s,₹]/g, "");
  if (cleaned === "") return { ok: false, error: "Enter a price" };
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return { ok: false, error: "Use digits only, with at most 2 decimal places, like 150 or 150.50" };

  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (paise < MIN_PRICE_PAISE) return { ok: false, error: "The lowest price is ₹1 an hour" };
  if (paise > MAX_PRICE_PAISE) return { ok: false, error: "The highest price is ₹1,00,000 an hour" };
  return { ok: true, paise };
}

// 15000 -> "150"   |   45050 -> "450.50"   (what goes back into the input box)
export function paiseToInput(paise: number | null): string {
  if (paise === null) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}
