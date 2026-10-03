import { isApiError } from "@/lib/api/client";
import type { BlockingBookings } from "../types";

// The backend refuses to change a seat or a time slot that people have upcoming bookings on, and says which bookings
// are in the way (409 SEAT_HAS_BOOKINGS / SLOT_HAS_BOOKINGS with details). Nothing is cancelled silently.
export function blockingBookings(error: unknown): BlockingBookings | null {
  if (!isApiError(error) || error.status !== 409) return null;
  if (error.code !== "SEAT_HAS_BOOKINGS" && error.code !== "SLOT_HAS_BOOKINGS") return null;
  const details = error.details;
  if (!details || typeof details.total !== "number" || !Array.isArray(details.bookings)) return null;
  return { total: details.total, bookings: details.bookings as BlockingBookings["bookings"] };
}

// Which form field a 409 belongs to, so the message appears next to it instead of in a banner.
export function conflictField(error: unknown): { field: "seatNumber" | "displayName" | "startTime"; message: string } | null {
  if (!isApiError(error) || error.status !== 409) return null;
  if (error.code === "SEAT_NUMBER_TAKEN") return { field: "seatNumber", message: "Another seat already has this number" };
  if (error.code === "SLOT_NAME_TAKEN") return { field: "displayName", message: "Another time slot already has this name" };
  if (error.code === "SLOT_OVERLAP") return { field: "startTime", message: error.message };
  return null;
}

// One sentence for a failed admin action, in words that tell the admin what to do.
export function describeAdminError(error: unknown): string {
  if (!isApiError(error)) return "Something went wrong. Please try again.";
  if (error.isNetworkError) return error.message;
  if (error.status === 403) return "Your account is not allowed to do this. If your role was just changed, sign out and back in.";
  if (error.status === 404) return "That record no longer exists. Refresh the page to see the latest list.";
  if (error.status === 429) return "Too many requests. Wait a moment and try again.";
  if (error.status >= 500) return "The server had a problem. Nothing was changed; please try again.";
  return error.message;
}
