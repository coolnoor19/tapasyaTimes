import type { DateString } from "@/lib/dates";
import type { SeatAvailability, TimeSlot } from "../types";

// Turns the backend's availability answer into what the date picker shows. Plain functions, no screen.

// A seat under maintenance or switched off cannot be booked on any day, so it never counts as free.
const inService = (seat: SeatAvailability) => seat.availability === "AVAILABLE" || seat.availability === "BOOKED";

// For each asked-about day, how many seats are free on THAT day (the number shown on the calendar).
export function freeSeatsByDate(seats: readonly SeatAvailability[], dates: readonly DateString[]): Record<DateString, number> {
  const result: Record<DateString, number> = {};
  for (const date of dates) {
    result[date] = seats.filter((seat) => inService(seat) && !seat.bookedDates.includes(date)).length;
  }
  return result;
}

// Seats that are free on EVERY one of the chosen days: the only ones a booking could use.
export function seatsFreeOnAll(seats: readonly SeatAvailability[], dates: readonly DateString[]): SeatAvailability[] {
  return seats.filter((seat) => inService(seat) && dates.every((date) => !seat.bookedDates.includes(date)));
}

// Days on which no seat at all is free. Choosing such a day can never lead to a booking.
export function fullyBookedDays(seats: readonly SeatAvailability[], dates: readonly DateString[]): DateString[] {
  const free = freeSeatsByDate(seats, dates);
  return dates.filter((date) => free[date] === 0);
}

const minutesOf = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

export const slotMinutes = (slot: Pick<TimeSlot, "startTime" | "endTime">) => minutesOf(slot.endTime) - minutesOf(slot.startTime);

// The same formula the backend uses to price one day (backend/src/services/pricing.ts): an hourly price,
// pro-rated for the slot's length, rounded to a whole paisa.
export const pricePerDayPaise = (pricePerHourPaise: number, slot: Pick<TimeSlot, "startTime" | "endTime">) =>
  Math.round((pricePerHourPaise * slotMinutes(slot)) / 60);

// Cheapest and dearest day-price among the given seats (null when none has a price).
export function dayPriceRange(seats: readonly SeatAvailability[], slot: Pick<TimeSlot, "startTime" | "endTime">): { min: number; max: number } | null {
  const prices = seats.flatMap((seat) => (seat.pricePerHourPaise === null ? [] : [pricePerDayPaise(seat.pricePerHourPaise, slot)]));
  return prices.length === 0 ? null : { min: Math.min(...prices), max: Math.max(...prices) };
}

// 60 -> "1 hr", 90 -> "1 hr 30 min", 45 -> "45 min"
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}
