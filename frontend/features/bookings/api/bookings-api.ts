import { apiRequest } from "@/lib/api/client";
import type { Booking, BookingPage, CreateBookingInput } from "../types";

export const bookingsApi = {
  // Holds the seat on every day for 10 minutes, or fails with nothing held. The Idempotency-Key makes a retry
  // (double click, flaky network, refresh) return the booking that was already made instead of a second one.
  create: (input: CreateBookingInput, idempotencyKey: string) =>
    apiRequest<Booking>("/bookings", { method: "POST", body: input, headers: { "Idempotency-Key": idempotencyKey } }),

  // Your own booking. Someone else's looks exactly like one that does not exist (404).
  get: (id: string, signal?: AbortSignal) => apiRequest<Booking>(`/bookings/${id}`, signal ? { signal } : {}),

  // Your bookings, newest first.
  list: (page: number, limit: number, signal?: AbortSignal) =>
    apiRequest<BookingPage>("/bookings", { query: { page, limit }, ...(signal ? { signal } : {}) }),
};

export const BOOKINGS_KEY = ["bookings"] as const;
export const bookingKey = (id: string) => ["bookings", "detail", id] as const;
export const bookingListKey = (page: number, limit: number) => ["bookings", "list", page, limit] as const;
