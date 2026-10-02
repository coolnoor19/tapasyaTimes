import { ConflictError } from "../../utils/errors/ConflictError.js"
import type { UpcomingBookings } from "./upcomingBookings.js"

// Which of the requested fields really change a record? Returns only those, plus their old values,
// so a "save" that changes nothing neither writes to the database nor clutters the audit log.
export function changedFields<T extends Record<string, unknown>>(
    current: T,
    patch: Partial<Record<keyof T, unknown>>,
): { changes: Partial<T>; before: Partial<T> } {
    const changes: Partial<T> = {}
    const before: Partial<T> = {}
    for (const key of Object.keys(patch) as (keyof T)[]) {
        const next = patch[key]
        if (next !== undefined && next !== current[key]) {
            changes[key] = next as T[keyof T]
            before[key] = current[key]
        }
    }
    return { changes, before }
}

// The agreed policy: a seat or slot with upcoming bookings is never changed silently or cancelled.
// The admin gets the list and must resolve those bookings first.
export function blockedByBookings(code: string, subject: string, upcoming: UpcomingBookings) {
    const shown = upcoming.bookings.length < upcoming.total ? ` (showing the first ${upcoming.bookings.length})` : ""
    return new ConflictError(
        `${subject} has ${upcoming.total} upcoming booking(s) and cannot be changed this way${shown}`,
        code,
        { total: upcoming.total, bookings: upcoming.bookings },
    )
}
