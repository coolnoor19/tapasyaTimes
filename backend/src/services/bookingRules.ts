import { BadRequestError } from "../utils/errors/BadRequestError.js"
import { getBusinessNow } from "../utils/businessTime.js"

// Time-dependent rules shared by the availability check and (later) booking creation,
// so both always agree on what can be booked.
//
// - A date before today (India time) is never bookable.
// - Today is bookable only while the slot has not started yet.
export function assertDatesBookable(dates: readonly string[], slotStartTime: string, now: Date = new Date()): void {
    const { date: today, time } = getBusinessNow(now)

    const past = dates.filter((date) => date < today)
    if (past.length > 0) {
        throw new BadRequestError(`Dates in the past cannot be booked: ${past.join(", ")}`)
    }

    // slotStartTime comes from a Postgres `time` column ("HH:MM:SS"), same format as `time`.
    if (dates.includes(today) && slotStartTime <= time) {
        throw new BadRequestError("This time slot has already started today")
    }
}
