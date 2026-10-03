"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/client";
import { AVAILABILITY_PREFIX } from "@/features/booking/api/booking-api";
import { BOOKINGS_KEY, bookingKey, bookingListKey, bookingsApi } from "../api/bookings-api";
import { attemptFingerprint, forgetAttempt, keyForAttempt } from "../lib/idempotency";
import type { Booking, BookingPage, CreateBookingInput } from "../types";

export const BOOKINGS_PAGE_SIZE = 10;

export function useMyBookings(page: number) {
  return useQuery({
    queryKey: bookingListKey(page, BOOKINGS_PAGE_SIZE),
    queryFn: ({ signal }) => bookingsApi.list(page, BOOKINGS_PAGE_SIZE, signal),
    placeholderData: keepPreviousData, // paging keeps the old page on screen until the new one is here
    refetchOnWindowFocus: "always", // a hold may have run out while the tab was away
  });
}

// The copy of a booking that an already-loaded "My bookings" page holds, with the moment it was fetched.
function findInLoadedLists(queryClient: QueryClient, id: string): { booking: Booking; updatedAt: number } | undefined {
  for (const query of queryClient.getQueryCache().findAll({ queryKey: [...BOOKINGS_KEY, "list"] })) {
    const page = query.state.data as BookingPage | undefined;
    const booking = page?.data.find((row) => row.id === id);
    if (booking) return { booking, updatedAt: query.state.dataUpdatedAt };
  }
  return undefined;
}

// One booking. When it is already in a loaded list it opens at once from that copy, and is re-fetched as soon as that
// copy is old (the list says when it was fetched, so a stale copy never counts as fresh).
export function useBooking(id: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: bookingKey(id ?? ""),
    queryFn: ({ signal }) => bookingsApi.get(id!, signal),
    enabled: id !== null,
    refetchOnWindowFocus: "always",
    staleTime: 10_000,
    initialData: () => (id ? findInLoadedLists(queryClient, id)?.booking : undefined),
    initialDataUpdatedAt: () => (id ? findInLoadedLists(queryClient, id)?.updatedAt : undefined),
  });
}

// Reserves the seat. The Idempotency-Key is kept while the outcome is unknown (so a retry cannot book twice) and dropped
// once the backend has answered clearly.
export function useReserveSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBookingInput) => bookingsApi.create(input, keyForAttempt(attemptFingerprint(input.seatId, input.timeSlotId, input.dates))),
    onSuccess: (booking, input) => {
      forgetAttempt(attemptFingerprint(input.seatId, input.timeSlotId, input.dates));
      queryClient.setQueryData(bookingKey(booking.id), booking);
      // The seat is now held: the list must include it and every seat map must show the seat as taken.
      void queryClient.invalidateQueries({ queryKey: [...BOOKINGS_KEY, "list"] });
      void queryClient.invalidateQueries({ queryKey: AVAILABILITY_PREFIX });
    },
    onError: (error, input) => {
      // A clear "no" from the backend settles the attempt. Network trouble and server errors do not.
      if (isApiError(error) && !error.isNetworkError && error.status >= 400 && error.status < 500 && error.status !== 429) {
        forgetAttempt(attemptFingerprint(input.seatId, input.timeSlotId, input.dates));
      }
      // Whatever the reason, the seat map may be out of date now.
      void queryClient.invalidateQueries({ queryKey: AVAILABILITY_PREFIX });
    },
  });
}
