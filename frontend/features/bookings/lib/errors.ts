import { isApiError } from "@/lib/api/client";
import { formatDateList } from "@/lib/dates";

// What went wrong when reserving a seat, in words a person can act on.
export interface ReserveProblem {
  tone: "danger" | "warn";
  title: string;
  message: string;
  // "choose-seat": send them back to the map. "retry": the same request may simply work again.
  next: "choose-seat" | "choose-days" | "retry";
  // The attempt got a clear answer from the backend, so a new attempt should use a new Idempotency-Key.
  // (When the answer never arrived - network, server error - the key is kept so a retry cannot double-book.)
  settled: boolean;
}

const asDates = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

export function describeReserveError(error: unknown, seatNumber: string): ReserveProblem {
  if (!isApiError(error)) {
    return { tone: "danger", title: "Something went wrong", message: "Please try again in a moment.", next: "retry", settled: false };
  }
  if (error.isNetworkError) {
    return { tone: "danger", title: "We couldn’t reach the server", message: "Check your connection and try again. You won’t be charged or booked twice.", next: "retry", settled: false };
  }

  if (error.status === 409 && error.code === "SEAT_TAKEN") {
    const dates = asDates(error.details?.conflictingDates);
    return {
      tone: "warn",
      title: `Seat ${seatNumber} was just taken`,
      message: dates.length > 0 ? `Someone booked it for ${formatDateList(dates)}. Please choose another seat.` : "Someone booked it a moment ago. Please choose another seat.",
      next: "choose-seat",
      settled: true,
    };
  }
  if (error.status === 409 && error.code === "SEAT_UNAVAILABLE") {
    return { tone: "warn", title: `Seat ${seatNumber} can’t be booked right now`, message: "It has been taken out of service. Please choose another seat.", next: "choose-seat", settled: true };
  }
  if (error.status === 409 && error.code === "IDEMPOTENCY_KEY_REUSED") {
    // Should not happen (the key is tied to this exact request); a new key fixes it.
    return { tone: "warn", title: "Please try again", message: "That request clashed with an earlier one. Press the button once more.", next: "retry", settled: true };
  }
  if (error.status === 404) {
    return { tone: "warn", title: "This booking is no longer possible", message: "The seat or the time slot has changed. Please start again.", next: "choose-days", settled: true };
  }
  if (error.status === 400) {
    // The backend explains dates in the past or a slot that has already started: show its words.
    return { tone: "warn", title: "These days can’t be booked any more", message: error.message, next: "choose-days", settled: true };
  }
  if (error.status === 403) {
    return { tone: "danger", title: "Your account can’t book right now", message: "Please contact the Tapasya Times team.", next: "retry", settled: true };
  }
  if (error.status === 429) {
    return { tone: "warn", title: "Too many requests", message: "Please wait a moment and try again.", next: "retry", settled: false };
  }
  return { tone: "danger", title: "We couldn’t reserve the seat", message: "Something went wrong on our side. Please try again in a moment.", next: "retry", settled: false };
}
