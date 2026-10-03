import { addDays, daysBetween, isValidDate, type DateString } from "@/lib/dates";
import type { BookingStatus } from "@/features/bookings/types";
import type { BookingFilters } from "../types";

// Everything a staff page needs to remember lives in the page address (?date=, ?page=, ?status=...), so a refresh,
// the Back button and a link sent to a colleague all give the same screen. An address can be typed by anyone, so
// everything read from it is checked here, and anything odd falls back to a safe default instead of an error.
// Plain functions of their inputs: no clock, no screen.

type Params = { get(name: string): string | null };

export const MAX_RANGE_DAYS = 31; // the backend's limit for occupancy
export const SEARCH_MIN = 2; // the backend rejects shorter customer searches
export const SEARCH_MAX = 100;
export const PAGE_SIZE = 20;

export const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = [
  { value: "PENDING", label: "Unpaid (held)" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "EXPIRED", label: "Expired" },
];
const STATUSES = new Set<string>(STATUS_OPTIONS.map((option) => option.value));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^[A-Z0-9-]{1,20}$/;

// "?page=3" -> 3. Missing, 0, negative, fractional, "abc" or absurdly large -> 1.
export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}

// A real calendar day, or undefined (the caller then uses today).
export const parseDate = (value: string | null): DateString | undefined => {
  const trimmed = value?.trim() ?? "";
  return isValidDate(trimmed) ? trimmed : undefined;
};

// Free text from a search box -> what to send. Spaces trimmed; shorter than 2 characters is NOT sent (the backend
// would answer 400); `tooShort` lets the page say why nothing happened.
export function cleanSearch(text: string): { value: string | undefined; tooShort: boolean } {
  const value = text.trim().replace(/\s+/g, " ").slice(0, SEARCH_MAX);
  if (value === "") return { value: undefined, tooShort: false };
  return value.length < SEARCH_MIN ? { value: undefined, tooShort: true } : { value, tooShort: false };
}

// "tt-ab12cd34 " -> "TT-AB12CD34". `invalid` when what is left cannot be a booking code at all.
export function cleanCode(text: string): { value: string | undefined; invalid: boolean } {
  const value = text.trim().toUpperCase();
  if (value === "") return { value: undefined, invalid: false };
  return CODE.test(value) ? { value, invalid: false } : { value: undefined, invalid: true };
}

// The booking list's filters, read from the address. Values that are not valid are simply dropped.
export function parseBookingFilters(params: Params): BookingFilters {
  const filters: BookingFilters = {};
  const code = cleanCode(params.get("code") ?? "").value;
  const search = cleanSearch(params.get("search") ?? "").value;
  const status = params.get("status") ?? "";
  const date = parseDate(params.get("date"));
  const customerId = params.get("customerId")?.trim() ?? "";
  if (code) filters.code = code;
  if (search) filters.search = search;
  if (STATUSES.has(status)) filters.status = status as BookingStatus;
  if (date) filters.date = date;
  if (UUID.test(customerId)) filters.customerId = customerId;
  return filters;
}

// Filters -> "?code=...&status=..." (page is added by the caller; changing a filter always goes back to page 1).
export function filtersToQuery(filters: BookingFilters, page = 1): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  if (page > 1) query.set("page", String(page));
  const text = query.toString();
  return text ? `?${text}` : "";
}

// ---------------------------------------------------------------------------
// Occupancy range
// ---------------------------------------------------------------------------

export type RangeProblem = "order" | "too-long" | "incomplete";

export interface Range {
  from: DateString;
  to: DateString;
}

// ?from=&to= -> a usable range. Missing ends default (from = today, to = from + 6 days); a reversed or over-long
// range is reported as a problem and replaced by the default so the page still shows something.
export function resolveRange(params: Params, today: DateString): { range: Range; problem: RangeProblem | null } {
  const from = parseDate(params.get("from"));
  const to = parseDate(params.get("to"));
  const fallback = (start: DateString): Range => ({ from: start, to: addDays(start, 6) });

  if (!from && !to) return { range: fallback(today), problem: null };
  if (from && !to) return { range: fallback(from), problem: null };
  if (!from && to) return { range: fallback(today), problem: "incomplete" };

  const start = from!;
  const end = to!;
  if (end < start) return { range: fallback(start), problem: "order" };
  if (daysBetween(start, end) >= MAX_RANGE_DAYS) return { range: fallback(start), problem: "too-long" };
  return { range: { from: start, to: end }, problem: null };
}

export const RANGE_PRESETS: { id: string; label: string; make: (today: DateString) => Range }[] = [
  { id: "next7", label: "Next 7 days", make: (today) => ({ from: today, to: addDays(today, 6) }) },
  { id: "next14", label: "Next 14 days", make: (today) => ({ from: today, to: addDays(today, 13) }) },
  { id: "next30", label: "Next 30 days", make: (today) => ({ from: today, to: addDays(today, 29) }) },
  { id: "last7", label: "Last 7 days", make: (today) => ({ from: addDays(today, -6), to: today }) },
  { id: "last30", label: "Last 30 days", make: (today) => ({ from: addDays(today, -29), to: today }) },
];

export const rangeProblemText: Record<RangeProblem, string> = {
  order: "The end day is before the start day, so a week from the start day is shown instead.",
  "too-long": `A range can cover at most ${MAX_RANGE_DAYS} days, so a week from the start day is shown instead.`,
  incomplete: "Pick a start day as well. Today is used for now.",
};
