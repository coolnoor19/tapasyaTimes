// The workspace runs on Indian time. "Today" and "now" for booking rules mean
// Asia/Kolkata, not the server's clock (a cloud server usually runs in UTC, which
// is 5.5 hours behind: at 00:15 IST on the 11th it is still the 10th in UTC).
export const BUSINESS_TIME_ZONE = "Asia/Kolkata"

const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23", // midnight is 00, never 24
})

// Current calendar date ("YYYY-MM-DD") and time ("HH:MM:SS") in business time.
// Both are zero-padded, so plain string comparison orders them correctly.
export function getBusinessNow(now: Date = new Date()): { date: string; time: string } {
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]))
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}:${parts.second}`,
    }
}

// True only for real calendar days: rejects "2026-02-30" and "2027-02-29", accepts "2028-02-29".
export function isValidCalendarDate(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) return false
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}
