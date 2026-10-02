import type { SeatTier } from "@/features/landing/types";

// GET /time-slots
export interface TimeSlot {
  id: string;
  displayName: string;
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export type SeatAvailabilityState = "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "INACTIVE";

export interface SeatAvailability {
  id: string;
  seatNumber: string;
  seatType: SeatTier;
  floor: number;
  availability: SeatAvailabilityState;
  // Which of the REQUESTED days this seat is already taken on (never who by)
  bookedDates: string[];
  pricePerHourPaise: number | null;
}

// GET /seats/availability?dates=...&timeSlotId=...
export interface AvailabilityResult {
  timeSlot: TimeSlot;
  dates: string[];
  seats: SeatAvailability[];
}
