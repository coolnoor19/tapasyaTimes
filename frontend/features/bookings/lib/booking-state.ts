import { formatDateList, type DateString } from "@/lib/dates";
import type { Booking } from "../types";

// What a person sees, worked out from what the backend stored plus the current time. Plain functions: no clock, no screen.
//
// Why not just show `booking.status`? The backend leaves an unpaid booking as PENDING after its 10 minutes are over
// (it is only released when someone else tries to take the seat). Showing "Pending" for a hold that ended would be wrong.
export type BookingPhase = "held" | "expired" | "confirmed" | "completed" | "cancelled";

export function bookingPhase(booking: Pick<Booking, "status" | "expiresAt" | "items">, nowMs: number, today: DateString): BookingPhase {
  switch (booking.status) {
    case "PENDING":
      return holdRemainingMs(booking, nowMs) > 0 ? "held" : "expired";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
      return "cancelled";
    case "COMPLETED":
      return "completed";
    case "CONFIRMED": {
      const lastDay = booking.items.reduce((latest, item) => (item.date > latest ? item.date : latest), "");
      return lastDay !== "" && lastDay < today ? "completed" : "confirmed";
    }
  }
}

// How long the hold lasts for this booking, in whole minutes (what the backend decided, not a number written here).
export const HOLD_MINUTES = 10; // only for the words BEFORE a booking exists; afterwards use holdMinutes()
export function holdMinutes(booking: Pick<Booking, "expiresAt" | "createdAt">): number {
  if (!booking.expiresAt) return HOLD_MINUTES;
  const minutes = Math.round((Date.parse(booking.expiresAt) - Date.parse(booking.createdAt)) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : HOLD_MINUTES;
}

// Milliseconds left on the hold (0 when over, or when there is no hold at all). Never more than the hold itself lasts: the
// clock estimate can be half a second off, and a fresh 10 minute hold must not read "10:01".
export function holdRemainingMs(booking: Pick<Booking, "expiresAt"> & Partial<Pick<Booking, "createdAt">>, nowMs: number): number {
  if (!booking.expiresAt) return 0;
  const end = Date.parse(booking.expiresAt);
  if (!Number.isFinite(end)) return 0;
  const remaining = Math.max(0, end - nowMs);
  const start = booking.createdAt ? Date.parse(booking.createdAt) : Number.NaN;
  return Number.isFinite(start) && end > start ? Math.min(remaining, end - start) : remaining;
}

// 582000 -> "09:42"   |   65000 -> "01:05"   |   0 -> "00:00". Rounds UP, so the last second still shows "00:01".
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// The same words in speech: 582000 -> "9 minutes 42 seconds" (for screen readers, which should not read "09:42").
export function describeCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  if (seconds > 0 || minutes === 0) parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  return parts.join(" ");
}

export const PHASE_LABEL: Record<BookingPhase, string> = {
  held: "Seat held",
  expired: "Hold expired",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PHASE_TONE: Record<BookingPhase, "warn" | "neutral" | "leaf" | "danger"> = {
  held: "warn",
  expired: "neutral",
  confirmed: "leaf",
  completed: "neutral",
  cancelled: "danger",
};

// The booking's days, and the same as text ("11–13 Oct").
export const bookingDays = (booking: Pick<Booking, "items">): DateString[] => booking.items.map((item) => item.date);
export const bookingDaysText = (booking: Pick<Booking, "items">): string => formatDateList(bookingDays(booking));
