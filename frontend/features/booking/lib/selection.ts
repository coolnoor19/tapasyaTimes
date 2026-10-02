import { addDays, addMonths, daysBetween, expandRange, isValidDate, isWeekend, monthOf, type DateString } from "@/lib/dates";

// The rules for choosing days. They mirror the backend (which checks everything again), so the page can say
// "no" before a request is made. All of it is plain functions of their inputs: no clock, no screen.

// Most days one booking may contain (backend: MAX_BOOKING_DATES).
export const MAX_DATES = 31;
// How far ahead the calendar lets you look. Only the page limits this; the backend has no limit.
export const MAX_MONTHS_AHEAD = 12;

export interface IndiaNow {
  date: DateString; // today in India
  time: string; // "HH:MM:SS" in India
}

// A slot "has started" once its start time is reached today. Both sides compare "HH:MM:SS" text, which orders correctly.
export function slotHasStartedToday(slotStartTime: string, now: IndiaNow): boolean {
  const start = slotStartTime.length === 5 ? `${slotStartTime}:00` : slotStartTime;
  return start <= now.time;
}

// Can this day be booked? Never a day before today. Today only while the slot has not started
// (with no slot chosen yet, today still counts: the slot decides later).
export function isBookableDay(date: DateString, slotStartTime: string | null, now: IndiaNow): boolean {
  if (date < now.date) return false;
  if (date === now.date && slotStartTime !== null && slotHasStartedToday(slotStartTime, now)) return false;
  return true;
}

// The days of a range, in order. Days that cannot be picked are left out, and the result is cut at MAX_DATES.
// `truncated` tells the page that the person asked for more than a booking can hold.
export function buildRange(
  from: DateString,
  to: DateString,
  options: { skipWeekends: boolean; isAllowed: (date: DateString) => boolean },
): { dates: DateString[]; truncated: boolean; skippedFull: DateString[] } {
  const [start, end] = from <= to ? [from, to] : [to, from]; // clicking the later day first is fine
  const dates: DateString[] = [];
  const skippedFull: DateString[] = [];
  let truncated = false;

  for (const date of expandRange(start, end)) {
    if (options.skipWeekends && isWeekend(date)) continue;
    if (!options.isAllowed(date)) {
      skippedFull.push(date);
      continue;
    }
    if (dates.length === MAX_DATES) {
      truncated = true;
      break;
    }
    dates.push(date);
  }
  return { dates, truncated, skippedFull };
}

// Adds a day, or removes it when it is already chosen. Refuses to go past MAX_DATES.
export function toggleDay(dates: readonly DateString[], date: DateString): { dates: DateString[]; limitReached: boolean } {
  if (dates.includes(date)) return { dates: dates.filter((d) => d !== date), limitReached: false };
  if (dates.length >= MAX_DATES) return { dates: [...dates], limitReached: true };
  return { dates: [...dates, date].sort(), limitReached: false };
}

export type PresetKind = "today" | "tomorrow" | "next7" | "next30";

export const PRESET_LABELS: Record<PresetKind, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  next7: "Next 7 days",
  next30: "Next 30 days",
};

// The days a quick button stands for. "Next 7 days" starts on the first day that can still be booked
// (today, or tomorrow when today's slot is already under way), and counts calendar days.
export function presetDates(
  kind: PresetKind,
  options: { slotStartTime: string | null; now: IndiaNow; skipWeekends: boolean; isAllowed: (date: DateString) => boolean },
): DateString[] {
  const { slotStartTime, now, skipWeekends, isAllowed } = options;
  const length = { today: 1, tomorrow: 1, next7: 7, next30: 30 }[kind];
  // "Today" and "Tomorrow" mean exactly that (and give nothing when it cannot be booked). The longer runs
  // start on the first day that still can be: today, or tomorrow when today's slot is already under way.
  const firstBookable = isBookableDay(now.date, slotStartTime, now) ? now.date : addDays(now.date, 1);
  const start = kind === "today" ? now.date : kind === "tomorrow" ? addDays(now.date, 1) : firstBookable;

  return expandRange(start, addDays(start, length - 1)).filter(
    (date) => isBookableDay(date, slotStartTime, now) && isAllowed(date) && !(skipWeekends && isWeekend(date) && length > 1),
  );
}

// Whether `dates` is one unbroken run of consecutive days (decides which mode to show for a restored selection).
export function isContiguous(dates: readonly DateString[]): boolean {
  const sorted = [...dates].sort();
  return sorted.every((date, index) => index === 0 || daysBetween(sorted[index - 1]!, date) === 1);
}

// ---------------------------------------------------------------------------
// The page address carries the choice, so a refresh or the Back button loses nothing:
//   /book?slot=<id>&dates=2026-08-11,2026-08-12
// The address can be edited by anyone, so everything read from it is checked.
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseSelectionParams(
  params: { get(name: string): string | null },
  now: IndiaNow,
): { slotId: string | null; dates: DateString[] } {
  const slot = params.get("slot")?.trim() ?? "";
  const raw = (params.get("dates") ?? "").split(",").map((part) => part.trim());

  // Real days, not in the past, and not beyond what the calendar can show (a hand-edited address could say 2099).
  const lastMonth = addMonths(monthOf(now.date), MAX_MONTHS_AHEAD);
  const valid = raw.filter((date) => isValidDate(date) && date >= now.date && monthOf(date) <= lastMonth);
  const unique = [...new Set(valid)].sort().slice(0, MAX_DATES);
  return { slotId: UUID.test(slot) ? slot : null, dates: unique };
}

export function selectionQuery(slotId: string | null, dates: readonly DateString[]): string {
  const parts: string[] = [];
  if (slotId) parts.push(`slot=${slotId}`);
  if (dates.length > 0) parts.push(`dates=${[...dates].sort().join(",")}`); // only digits, "-" and ",": nothing to escape
  return parts.join("&");
}
