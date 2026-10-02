// Booking limits. These are business decisions, kept in one place so they are easy to change.

// Most dates one booking (or one availability request) may contain.
// Proposed default; to be confirmed with the owner.
export const MAX_BOOKING_DATES = 31

// How long an unpaid booking keeps its seats before they are released (agreed: 10 minutes).
export const HOLD_MINUTES = 10
