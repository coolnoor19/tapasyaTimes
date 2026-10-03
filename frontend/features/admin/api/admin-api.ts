import { apiRequest, type RequestOptions } from "@/lib/api/client";
import type { SeatTier } from "@/features/landing/types";
import type {
  AdminPrice,
  AdminSeat,
  AdminTimeSlot,
  AdminUser,
  AdminUserDetail,
  AuditEntry,
  AuditFilters,
  Paged,
  SeatStatus,
  UserFilters,
} from "../types";

// With exactOptionalPropertyTypes an absent signal must be left out, not passed as undefined.
const withSignal = (signal?: AbortSignal): RequestOptions => (signal ? { signal } : {});

// Every /admin/* call. Reads are GET; every write answers with the saved record, which the hooks put straight into the
// cache, so saving never needs a second request to "see the result".
export const adminApi = {
  // ONE request returns every seat. Filtering and paging happen in the browser from that single answer.
  seats: (signal?: AbortSignal) => apiRequest<{ seats: AdminSeat[] }>("/admin/seats", withSignal(signal)).then((r) => r.seats),
  createSeat: (input: { seatNumber: string; seatType: SeatTier; floor: number }) => apiRequest<AdminSeat>("/admin/seats", { method: "POST", body: input }),
  updateSeat: (id: string, patch: Partial<{ seatNumber: string; seatType: SeatTier; floor: number; status: SeatStatus }>) =>
    apiRequest<AdminSeat>(`/admin/seats/${id}`, { method: "PATCH", body: patch }),

  timeSlots: (signal?: AbortSignal) => apiRequest<{ timeSlots: AdminTimeSlot[] }>("/admin/time-slots", withSignal(signal)).then((r) => r.timeSlots),
  createTimeSlot: (input: { startTime: string; endTime: string; displayName?: string }) => apiRequest<AdminTimeSlot>("/admin/time-slots", { method: "POST", body: input }),
  updateTimeSlot: (id: string, patch: Partial<{ startTime: string; endTime: string; displayName: string; isActive: boolean }>) =>
    apiRequest<AdminTimeSlot>(`/admin/time-slots/${id}`, { method: "PATCH", body: patch }),

  prices: (signal?: AbortSignal) => apiRequest<{ prices: AdminPrice[] }>("/admin/seat-prices", withSignal(signal)).then((r) => r.prices),
  setPrice: (seatType: SeatTier, pricePerHourPaise: number) =>
    apiRequest<{ seatType: SeatTier; pricePerHourPaise: number; updatedAt: string }>(`/admin/seat-prices/${seatType}`, { method: "PUT", body: { pricePerHourPaise } }),

  users: (filters: UserFilters, page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<Paged<AdminUser>>("/admin/users", { query: { ...filters, page, limit }, ...withSignal(signal) }),
  user: (id: string, signal?: AbortSignal) => apiRequest<AdminUserDetail>(`/admin/users/${id}`, withSignal(signal)),
  setUserStatus: (id: string, status: "ACTIVE" | "SUSPENDED") => apiRequest<AdminUser>(`/admin/users/${id}/status`, { method: "PATCH", body: { status } }),
  setUserRole: (id: string, role: "USER" | "MANAGER") => apiRequest<AdminUser>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),

  auditLogs: (filters: AuditFilters, page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<Paged<AuditEntry>>("/admin/audit-logs", { query: { ...filters, page, limit }, ...withSignal(signal) }),
};

// One place for every cache key, so a screen and the code that updates its data can never drift apart.
export const adminKeys = {
  seats: ["admin", "seats"] as const,
  timeSlots: ["admin", "time-slots"] as const,
  prices: ["admin", "prices"] as const,
  usersPrefix: ["admin", "users"] as const,
  users: (filters: UserFilters, page: number) => ["admin", "users", "list", filters, page] as const,
  user: (id: string) => ["admin", "users", "detail", id] as const,
  auditPrefix: ["admin", "audit"] as const,
  audit: (filters: AuditFilters, page: number, limit: number) => ["admin", "audit", filters, page, limit] as const,
};
