"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, adminKeys } from "../api/admin-api";
import type { AdminUser, AdminUserDetail, AuditFilters, Paged, UserFilters } from "../types";

export const ADMIN_PAGE_SIZE = 20;
export const AUDIT_PAGE_SIZE = 25;

// Seats, time slots and prices are small, complete lists: each is ONE request, shared by every component that asks
// (React Query de-duplicates identical keys) and reused for 60 seconds, so moving between admin screens and back
// does not hit the server again. Admins' own saves keep the cache current without a re-fetch (see use-admin-mutations).
const LIST_STALE_MS = 60_000;

export const useAdminSeats = () => useQuery({ queryKey: adminKeys.seats, queryFn: ({ signal }) => adminApi.seats(signal), staleTime: LIST_STALE_MS });

export const useAdminTimeSlots = () => useQuery({ queryKey: adminKeys.timeSlots, queryFn: ({ signal }) => adminApi.timeSlots(signal), staleTime: LIST_STALE_MS });

export const useAdminPrices = () => useQuery({ queryKey: adminKeys.prices, queryFn: ({ signal }) => adminApi.prices(signal), staleTime: LIST_STALE_MS });

export const useAdminUsers = (filters: UserFilters, page: number) =>
  useQuery({
    queryKey: adminKeys.users(filters, page),
    queryFn: ({ signal }) => adminApi.users(filters, page, ADMIN_PAGE_SIZE, signal),
    placeholderData: keepPreviousData, // paging and filtering keep the old rows on screen (dimmed) until the new ones arrive
  });

// One person. The list the admin came from already knows most of it, so the page paints at once from that copy
// (placeholder data is never stored as if it were fresh) while the real answer, which adds the booking count, loads.
export function useAdminUser(id: string) {
  const queryClient = useQueryClient();
  return useQuery<AdminUserDetail>({
    queryKey: adminKeys.user(id),
    queryFn: ({ signal }) => adminApi.user(id, signal),
    placeholderData: () => {
      for (const [, page] of queryClient.getQueriesData<Paged<AdminUser>>({ queryKey: [...adminKeys.usersPrefix, "list"] })) {
        const found = page?.data.find((user) => user.id === id);
        if (found) return found;
      }
      return undefined;
    },
  });
}

export const useAuditLog = (filters: AuditFilters, page: number, limit = AUDIT_PAGE_SIZE) =>
  useQuery({
    queryKey: adminKeys.audit(filters, page, limit),
    queryFn: ({ signal }) => adminApi.auditLogs(filters, page, limit, signal),
    placeholderData: keepPreviousData,
  });
