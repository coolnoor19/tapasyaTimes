import type { QueryClient } from "@tanstack/react-query";
import type { DateString } from "@/lib/dates";
import { availabilityKey, bookingApi } from "./booking-api";

// How long an availability answer counts as fresh. Shared by every place that asks, so a prefetch made on
// one screen is still "fresh" when the next screen asks the same question a moment later.
export const AVAILABILITY_STALE_MS = 15_000;

// Starts loading the seat availability for a choice BEFORE the next screen needs it. Called when the person
// points at (or tabs to) "Choose your seat": by the time they click, the answer is in the cache.
// Does nothing when a fresh answer is already there, and never throws (a failed prefetch just means the
// next screen loads normally).
export function prefetchAvailability(queryClient: QueryClient, slotId: string, dates: readonly DateString[]) {
  return queryClient.prefetchQuery({
    queryKey: availabilityKey(slotId, dates),
    queryFn: ({ signal }) => bookingApi.availability({ timeSlotId: slotId, dates: [...dates] }, signal),
    staleTime: AVAILABILITY_STALE_MS,
  });
}
