import { apiRequest } from "@/lib/api/client";
import type { AvailabilityResult, TimeSlot } from "../types";

export const bookingApi = {
  // Active slots, earliest first. Needs a signed-in user.
  timeSlots: () => apiRequest<{ timeSlots: TimeSlot[] }>("/time-slots").then((response) => response.timeSlots),

  // Which seats are free for ALL of these days in this slot (a seat is only offered if it is free on every day).
  // 1 to 31 days, no repeats, nothing in the past, and today only while the slot has not started.
  availability: (input: { timeSlotId: string; dates: string[] }, signal?: AbortSignal) =>
    apiRequest<AvailabilityResult>("/seats/availability", {
      query: { dates: input.dates, timeSlotId: input.timeSlotId },
      ...(signal ? { signal } : {}),
    }),
};

// One shared cache key per (slot, set of days). The date picker, the summary and the seat map (next phase)
// ask the same question with the same key, so the answer is fetched once and reused.
export const availabilityKey = (timeSlotId: string | null, dates: readonly string[]) =>
  ["booking", "availability", timeSlotId, dates.join(",")] as const;

export const TIME_SLOTS_KEY = ["booking", "time-slots"] as const;
