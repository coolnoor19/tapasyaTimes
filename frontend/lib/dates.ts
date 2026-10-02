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
