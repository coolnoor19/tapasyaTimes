// The backend stores and sends money as integer PAISE (100 paise = Rs 1). Only this file turns
// paise into text, so the UI never does its own rounding.

const WHOLE = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const WITH_PAISE = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 15000 -> "₹150"   |   45050 -> "₹450.50"   |   123456700 -> "₹12,34,567" (Indian digit grouping)
export function formatRupees(paise: number): string {
  if (!Number.isFinite(paise)) return "—";
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.round(paise));
  const rupees = abs / 100;
  return `${sign}₹${abs % 100 === 0 ? WHOLE.format(rupees) : WITH_PAISE.format(rupees)}`;
}

// 15000 -> "₹150/hr"
export const formatPerHour = (paise: number) => `${formatRupees(paise)}/hr`;
