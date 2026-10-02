// Booking dates are plain calendar days ("YYYY-MM-DD") in India time. They are kept as strings and
// calculated in UTC so a visitor's own time zone (or daylight saving) can never shift a day.

export type DateString = string;

const IST_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toUtc = (date: DateString) => {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day);
};

const fromUtc = (ms: number): DateString => new Date(ms).toISOString().slice(0, 10);

// Today's date in India, whatever the visitor's clock or time zone says.
export const todayInIndia = (now: Date = new Date()): DateString => IST_PARTS.format(now);

export const addDays = (date: DateString, days: number): DateString => fromUtc(toUtc(date) + days * 86_400_000);

export const daysBetween = (from: DateString, to: DateString): number =>
  Math.round((toUtc(to) - toUtc(from)) / 86_400_000);

// Every day from `start` to `end`, both included. Empty when end is before start.
export function expandRange(start: DateString, end: DateString): DateString[] {
  const count = daysBetween(start, end);
  return count < 0 ? [] : Array.from({ length: count + 1 }, (_, i) => addDays(start, i));
}

// Month and weekday names come from fixed tables, not Intl: the names Intl returns differ between
// browsers and Node versions ("Sep" vs "Sept"), which would make the server-rendered HTML disagree with
// the browser's and cause a hydration warning.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const parts = (date: DateString) => {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
};

// "2026-08-11" -> "11 Aug"
const dayMonth = (date: DateString) => {
  const { day, month } = parts(date);
  return `${day} ${MONTHS[month - 1]}`;
};

// "2026-08-11" -> "Tue, 11 Aug"
export const formatDay = (date: DateString) => `${WEEKDAYS[parts(date).weekday]}, ${dayMonth(date)}`;

// Groups a list of days into compact ranges, which is how a person reads them:
//   ["2026-08-11","2026-08-12","2026-08-13"]  ->  "11–13 Aug"
//   ["2026-08-11","2026-08-13"]               ->  "11 Aug, 13 Aug"
//   ["2026-08-30","2026-08-31","2026-09-01"]  ->  "30 Aug – 1 Sep"
export function formatDateList(dates: readonly DateString[]): string {
  const sorted = [...new Set(dates)].sort();
  if (sorted.length === 0) return "";

  const runs: [DateString, DateString][] = [];
  for (const date of sorted) {
    const last = runs[runs.length - 1];
    if (last && daysBetween(last[1], date) === 1) last[1] = date;
    else runs.push([date, date]);
  }

  return runs
    .map(([start, end]) => {
      if (start === end) return dayMonth(start);
      const sameMonth = start.slice(0, 7) === end.slice(0, 7);
      return sameMonth ? `${parts(start).day}–${dayMonth(end)}` : `${dayMonth(start)} – ${dayMonth(end)}`;
    })
    .join(", ");
}

// A year is only worth showing when it is not the current one: "11 Aug" vs "11 Aug 2027".
export function formatDayWithYear(date: DateString, now: Date = new Date()): string {
  const { year } = parts(date);
  return String(year) === todayInIndia(now).slice(0, 4) ? dayMonth(date) : `${dayMonth(date)} ${year}`;
}

// "10:00:00" or "10:00" -> "10:00 AM"
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number) as [number, number];
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

// ---------------------------------------------------------------------------
// India clock, weekdays and months (used by the booking pages)
// ---------------------------------------------------------------------------

const IST_CLOCK = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23", // midnight is 00, never 24
});

// The current date ("YYYY-MM-DD") and time ("HH:MM:SS") in India: the clock the booking rules run on.
// Same approach as the backend, so "has this slot started today?" gets the same answer on both sides.
export function nowInIndia(now: Date = new Date()): { date: DateString; time: string } {
  const parts = Object.fromEntries(IST_CLOCK.formatToParts(now).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}:${parts.second}` };
}

// True only for real calendar days: rejects "2026-02-30", accepts "2028-02-29".
export function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// 0 = Sunday ... 6 = Saturday
export const weekdayOf = (date: DateString): number => new Date(toUtc(date)).getUTCDay();
export const isWeekend = (date: DateString): boolean => weekdayOf(date) === 0 || weekdayOf(date) === 6;

// "YYYY-MM"
export type MonthKey = string;
export const monthOf = (date: DateString): MonthKey => date.slice(0, 7);

export function addMonths(month: MonthKey, count: number): MonthKey {
  const [year, mon] = month.split("-").map(Number) as [number, number];
  const index = year * 12 + (mon - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// Every day of the month, in order (28 to 31 of them).
export function datesInMonth(month: MonthKey): DateString[] {
  const first = `${month}-01`;
  const last = addDays(`${addMonths(month, 1)}-01`, -1);
  return expandRange(first, last);
}

// The calendar widget works with JavaScript Dates. A day is given as local NOON, not midnight: some time zones
// skip midnight on daylight-saving days, and noon is never skipped, so the day can never shift.
export const toPickerDate = (date: DateString): Date => {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(year, month - 1, day, 12);
};
// ...and back, using the same local reading, so the round trip is exact in any time zone.
export const fromPickerDate = (date: Date): DateString =>
  `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// "09:00", "10:00" -> "9:00 – 10:00 AM"   |   "11:00", "13:30" -> "11:00 AM – 1:30 PM"
// The AM/PM is said once when both ends share it, which is how people write a time range.
export function formatTimeRange(start: string, end: string): string {
  const from = formatTime(start);
  const to = formatTime(end);
  const fromSuffix = from.slice(-2);
  return fromSuffix === to.slice(-2) ? `${from.slice(0, -3)} – ${to}` : `${from} – ${to}`;
}
