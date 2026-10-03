import { apiRequest } from "@/lib/api/client";
import type { Board, BookingFilters, CustomerDetail, CustomerPage, Occupancy, StaffBooking, StaffBookingPage } from "../types";

// Everything staff read. All GET: in V1 managers and admins only look, they do not change bookings.
export const staffApi = {
  // One day's floor view. No date = today (India time).
  board: (date: string | undefined, signal?: AbortSignal) =>
    apiRequest<Board>("/manager/board", { query: { date }, ...(signal ? { signal } : {}) }),

  // Day-by-day occupancy, at most 31 days. No dates = today and the next 6 days.
  occupancy: (range: { from?: string | undefined; to?: string | undefined }, signal?: AbortSignal) =>
    apiRequest<Occupancy>("/manager/occupancy", { query: { from: range.from, to: range.to }, ...(signal ? { signal } : {}) }),

  bookings: (filters: BookingFilters, page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<StaffBookingPage>("/manager/bookings", { query: { ...filters, page, limit }, ...(signal ? { signal } : {}) }),

  booking: (id: string, signal?: AbortSignal) => apiRequest<StaffBooking>(`/manager/bookings/${id}`, signal ? { signal } : {}),

  customers: (search: string | undefined, page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<CustomerPage>("/manager/customers", { query: { search, page, limit }, ...(signal ? { signal } : {}) }),

  customer: (id: string, signal?: AbortSignal) => apiRequest<CustomerDetail>(`/manager/customers/${id}`, signal ? { signal } : {}),
};

export const staffKeys = {
  all: ["staff"] as const,
  board: (date: string | undefined) => ["staff", "board", date ?? "today"] as const,
  occupancy: (from: string | undefined, to: string | undefined) => ["staff", "occupancy", from ?? "", to ?? ""] as const,
  bookings: (filters: BookingFilters, page: number) => ["staff", "bookings", filters, page] as const,
  booking: (id: string) => ["staff", "booking", id] as const,
  customers: (search: string | undefined, page: number) => ["staff", "customers", search ?? "", page] as const,
  customer: (id: string) => ["staff", "customer", id] as const,
};
