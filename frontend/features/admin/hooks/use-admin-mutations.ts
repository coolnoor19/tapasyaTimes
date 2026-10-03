"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { AVAILABILITY_PREFIX, TIME_SLOTS_KEY } from "@/features/booking/api/booking-api";
import type { SeatTier } from "@/features/landing/types";
import { staffKeys } from "@/features/staff/api/staff-api";
import { adminApi, adminKeys } from "../api/admin-api";
import { sortSeats } from "../lib/seat-filters";
import { sortSlots } from "../lib/slot-math";
import type { AdminPrice, AdminSeat, AdminTimeSlot, AdminUser, AdminUserDetail, Paged } from "../types";

// How a save updates what the app already knows, WITHOUT asking the server again:
//  1. Every write answers with the saved record, so it is put straight into the cached list (setQueryData). No re-fetch.
//  2. Screens that are NOT open and show the same facts (landing prices, the customer's seat map, the staff floor board)
//     are only marked stale, never fetched now. They refresh the next time somebody actually opens them.
//  Result: one request per save, however many screens depend on the change.

// Facts customers and staff see that a seat / slot / price change can alter.
const marksOnConfigChange: readonly (readonly unknown[])[] = [["public", "overview"], TIME_SLOTS_KEY, AVAILABILITY_PREFIX, [...staffKeys.all, "board"], [...staffKeys.all, "occupancy"]];

function markConfigDependentsStale(queryClient: QueryClient) {
  for (const queryKey of marksOnConfigChange) void queryClient.invalidateQueries({ queryKey, refetchType: "none" });
}

// The audit log gained an entry. A history list that is on screen right now (a user's page) refreshes; others just go stale.
const markAuditStale = (queryClient: QueryClient) => void queryClient.invalidateQueries({ queryKey: adminKeys.auditPrefix });

export function useCreateSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createSeat,
    onSuccess: (seat) => {
      queryClient.setQueryData<AdminSeat[]>(adminKeys.seats, (old) => (old ? sortSeats([...old, seat]) : old));
      markConfigDependentsStale(queryClient);
      markAuditStale(queryClient);
    },
  });
}

export function useUpdateSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof adminApi.updateSeat>[1] }) => adminApi.updateSeat(id, patch),
    onSuccess: (saved) => {
      // the update answer has no booking count: keep the one the list already had
      queryClient.setQueryData<AdminSeat[]>(adminKeys.seats, (old) => old && sortSeats(old.map((seat) => (seat.id === saved.id ? { ...saved, ...(seat.upcomingBookings !== undefined ? { upcomingBookings: seat.upcomingBookings } : {}) } : seat))));
      markConfigDependentsStale(queryClient);
      markAuditStale(queryClient);
    },
  });
}

export function useCreateTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.createTimeSlot,
    onSuccess: (slot) => {
      queryClient.setQueryData<AdminTimeSlot[]>(adminKeys.timeSlots, (old) => (old ? sortSlots([...old, slot]) : old));
      markConfigDependentsStale(queryClient);
      markAuditStale(queryClient);
    },
  });
}

export function useUpdateTimeSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof adminApi.updateTimeSlot>[1] }) => adminApi.updateTimeSlot(id, patch),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminTimeSlot[]>(adminKeys.timeSlots, (old) => old && sortSlots(old.map((slot) => (slot.id === saved.id ? { ...saved, ...(slot.upcomingBookings !== undefined ? { upcomingBookings: slot.upcomingBookings } : {}) } : slot))));
      markConfigDependentsStale(queryClient);
      markAuditStale(queryClient);
    },
  });
}

export function useSetPrice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ seatType, paise }: { seatType: SeatTier; paise: number }) => adminApi.setPrice(seatType, paise),
    onSuccess: (saved) => {
      queryClient.setQueryData<AdminPrice[]>(adminKeys.prices, (old) => old?.map((price) => (price.seatType === saved.seatType ? { ...price, pricePerHourPaise: saved.pricePerHourPaise, updatedAt: saved.updatedAt } : price)));
      markConfigDependentsStale(queryClient);
      markAuditStale(queryClient);
    },
  });
}

// A changed account shows up in three places: the open person page, every cached users list, and the manager's customer
// screens. The first is written directly; lists that are filtered (status = Active) may no longer match, so they are only marked stale.
function applyUserChange(queryClient: QueryClient, user: AdminUser) {
  queryClient.setQueryData<AdminUserDetail>(adminKeys.user(user.id), (old) => ({ ...user, ...(old?.bookingCount !== undefined ? { bookingCount: old.bookingCount } : {}) }));
  queryClient.setQueriesData<Paged<AdminUser>>({ queryKey: [...adminKeys.usersPrefix, "list"] }, (old) => old && { ...old, data: old.data.map((row) => (row.id === user.id ? user : row)) });
  void queryClient.invalidateQueries({ queryKey: [...adminKeys.usersPrefix, "list"], refetchType: "none" });
  void queryClient.invalidateQueries({ queryKey: [...staffKeys.all, "customers"], refetchType: "none" });
  void queryClient.invalidateQueries({ queryKey: staffKeys.customer(user.id), refetchType: "none" });
  markAuditStale(queryClient);
}

export function useSetUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) => adminApi.setUserStatus(id, status),
    onSuccess: (user) => applyUserChange(queryClient, user),
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: "USER" | "MANAGER" }) => adminApi.setUserRole(id, role),
    onSuccess: (user) => applyUserChange(queryClient, user),
  });
}
