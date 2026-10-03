import type { Role } from "@/features/auth/types";
import type { SeatTier } from "@/features/landing/types";

// What the /admin/* endpoints answer. Dates are ISO strings, money is integer paise.

export type SeatStatus = "AVAILABLE" | "MAINTENANCE" | "INACTIVE";

// GET /admin/seats. The create / update answers do NOT carry `upcomingBookings` (only the list does), so it is optional:
// when a saved seat replaces the one in the list, the old count is kept.
export interface AdminSeat {
  id: string;
  seatNumber: string;
  seatType: SeatTier;
  floor: number;
  status: SeatStatus;
  createdAt: string;
  updatedAt: string;
  upcomingBookings?: number;
}

export interface AdminTimeSlot {
  id: string;
  displayName: string;
  startTime: string; // "HH:MM"
  endTime: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  upcomingBookings?: number;
}

export interface AdminPrice {
  seatType: SeatTier;
  pricePerHourPaise: number | null; // null = no price set yet, so these seats cannot be booked
  updatedAt: string | null;
}

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: Role;
  status: "ACTIVE" | "SUSPENDED";
  isVerified: boolean;
  isLocked: boolean;
  createdAt: string;
}

// `bookingCount` is missing while the page is painted from the list's copy of the person (the detail answer then fills it in).
export interface AdminUserDetail extends AdminUser {
  bookingCount?: number;
}

export interface Paged<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface AuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string | null } | null;
}

export interface UserFilters {
  search?: string;
  role?: "ADMIN" | "MANAGER" | "USER";
  status?: "ACTIVE" | "SUSPENDED";
  isVerified?: "true" | "false";
}

export interface AuditFilters {
  action?: string;
  targetType?: string;
  targetId?: string;
  actorId?: string;
}

// The 409 SEAT_HAS_BOOKINGS / SLOT_HAS_BOOKINGS answer: what is in the way of the change.
export interface BlockingBookings {
  total: number;
  bookings: { bookingCode: string; date: string; timeSlot: string; seatNumber: string; status: string }[];
}
