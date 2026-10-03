"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { staffApi, staffKeys } from "../api/staff-api";
import type { BookingFilters } from "../types";
import { PAGE_SIZE } from "../lib/params";

// How often a screen that other people's bookings can change checks again while it is open and visible.
const LIVE_MS = 30_000;

// The floor for one day. Refreshes by itself: a seat is taken, a hold runs out, someone is added at the desk.
export function useBoard(date: string | undefined) {
  return useQuery({
    queryKey: staffKeys.board(date),
    queryFn: ({ signal }) => staffApi.board(date, signal),
    refetchInterval: LIVE_MS,
    refetchOnWindowFocus: "always",
    placeholderData: keepPreviousData, // moving to another day keeps the old floor on screen (dimmed) until the new one arrives
  });
}

export function useOccupancy(range: { from?: string | undefined; to?: string | undefined }) {
  return useQuery({
    queryKey: staffKeys.occupancy(range.from, range.to),
    queryFn: ({ signal }) => staffApi.occupancy(range, signal),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useStaffBookings(filters: BookingFilters, page: number, options: { limit?: number; live?: boolean } = {}) {
  const limit = options.limit ?? PAGE_SIZE;
  return useQuery({
    queryKey: [...staffKeys.bookings(filters, page), limit],
    queryFn: ({ signal }) => staffApi.bookings(filters, page, limit, signal),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: "always",
    ...(options.live ? { refetchInterval: LIVE_MS } : {}),
  });
}

export function useStaffBooking(id: string) {
  return useQuery({
    queryKey: staffKeys.booking(id),
    queryFn: ({ signal }) => staffApi.booking(id, signal),
    refetchOnWindowFocus: "always",
  });
}

export function useCustomers(search: string | undefined, page: number) {
  return useQuery({
    queryKey: staffKeys.customers(search, page),
    queryFn: ({ signal }) => staffApi.customers(search, page, PAGE_SIZE, signal),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: staffKeys.customer(id),
    queryFn: ({ signal }) => staffApi.customer(id, signal),
    refetchOnWindowFocus: "always",
  });
}

// A value that follows `value` only after it has stayed the same for `delayMs`: a search box does not fire a request
// for every key press.
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
