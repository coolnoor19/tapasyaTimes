import type { SeatTier } from "@/features/landing/types";
import type { TimeSlot } from "@/features/booking/types";

// What the backend stores. Nothing sets COMPLETED yet and there is no payment, so today bookings are PENDING or EXPIRED.
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "EXPIRED";
export type BookingItemStatus = "HELD" | "CONFIRMED" | "RELEASED";

export interface BookingItem {
  id: string;
  date: string; // YYYY-MM-DD
  amountPaise: number;
  status: BookingItemStatus;
}

// POST /bookings, GET /bookings/:id and every row of GET /bookings
export interface Booking {
  id: string;
  bookingCode: string; // "TT-XXXXXXXX"
  status: BookingStatus;
  totalAmountPaise: number;
  currency: "INR";
  // When an unpaid hold ends (ISO, server time). The backend does not flip PENDING to EXPIRED by itself yet.
  expiresAt: string | null;
  createdAt: string;
  seat: { id: string; seatNumber: string; seatType: SeatTier; floor: number } | null;
  timeSlot: TimeSlot | null;
  items: BookingItem[];
}

// GET /bookings?page&limit
export interface BookingPage {
  data: Booking[];
  page: number;
  limit: number;
  total: number;
}

export interface CreateBookingInput {
  seatId: string;
  timeSlotId: string;
  dates: string[];
}
