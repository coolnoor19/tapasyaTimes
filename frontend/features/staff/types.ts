import type { SeatTier } from "@/features/landing/types";
import type { Booking, BookingItemStatus, BookingStatus } from "@/features/bookings/types";

// ---- GET /manager/board?date -------------------------------------------------

export type BoardSeatState = "AVAILABLE" | "BOOKED" | "MAINTENANCE" | "INACTIVE";

export interface BoardCustomer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface BoardBooking {
  id: string;
  bookingCode: string;
  status: BookingStatus;
  // HELD = reserved but unpaid, CONFIRMED = paid
  itemStatus: Exclude<BookingItemStatus, "RELEASED">;
  // Only for a HELD seat: when the payment window closes (the backend already leaves out holds that are over)
  holdExpiresAt: string | null;
  customer: BoardCustomer;
}

export interface BoardSeat {
  id: string;
  seatNumber: string;
  seatType: SeatTier;
  floor: number;
  state: BoardSeatState;
  booking: BoardBooking | null;
}

export interface BoardSlot {
  timeSlot: { id: string; displayName: string; startTime: string; endTime: string; isActive: boolean };
  // counted over seats in service only
  summary: { capacity: number; booked: number; available: number };
  seats: BoardSeat[];
}

export interface Board {
  date: string;
  isToday: boolean;
  slots: BoardSlot[];
}

// ---- GET /manager/occupancy?from&to -----------------------------------------

export interface TierOccupancy {
  capacity: number;
  booked: number;
  occupancyPercent: number;
}

export interface OccupancyDay {
  date: string;
  capacity: number;
  booked: number;
  occupancyPercent: number;
  bySeatType: Record<SeatTier, TierOccupancy>;
}

export interface Occupancy {
  from: string;
  to: string;
  activeTimeSlots: number;
  summary: { capacity: number; booked: number; occupancyPercent: number };
  days: OccupancyDay[];
}

// ---- bookings and customers as staff see them ------------------------------------------

export interface StaffCustomerContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

// GET /manager/bookings and /manager/bookings/:id: a booking plus its customer
export interface StaffBooking extends Booking {
  customer: StaffCustomerContact;
  // unpaid and past its deadline: the seat has already been given back
  holdExpired: boolean;
}

export interface StaffBookingPage {
  data: StaffBooking[];
  page: number;
  limit: number;
  total: number;
}

export interface Customer extends StaffCustomerContact {
  isVerified: boolean;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  bookingCount: number;
}

export interface CustomerPage {
  data: Customer[];
  page: number;
  limit: number;
  total: number;
}

// GET /manager/customers/:id
export interface CustomerDetail extends Customer {
  recentBookings: StaffBooking[];
}

export interface BookingFilters {
  code?: string;
  status?: BookingStatus;
  date?: string;
  search?: string;
  customerId?: string;
  seatId?: string;
  timeSlotId?: string;
}
