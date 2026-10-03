"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { DateString } from "@/lib/dates";
import { availabilityKey, bookingApi } from "@/features/booking/api/booking-api";
import { AVAILABILITY_STALE_MS } from "@/features/booking/api/prefetch";
import { MAX_DATES } from "@/features/booking/lib/selection";
import type { AvailabilityResult } from "@/features/booking/types";
import { buildSeatMap } from "../lib/seat-map";

// Live refresh while the page is open and visible: other people book seats too.
const POLL_MS = 20_000;

// The seat map's data. Four things make it feel instant:
//  1. SAME CACHE KEY as the date picker's check, so the answer fetched on the previous screen is reused: the map
//     appears with no loading state, then quietly refreshes in the background if it has gone stale.
//  2. `select` reshapes the raw seat list into floors/sections/rows ONCE per new answer, not on every render.
//  3. The query cache compares the old and new shapes, so a refresh where nothing changed keeps every object the
//     same, and unchanged seats do not re-render. Only a seat that really changed repaints.
//  4. It refreshes by itself (polling, and straight away when the tab regains focus) and pauses while the tab is hidden.
// `dates` must keep the same identity between renders (the caller memoises it).
export function useSeatMap(slotId: string | null, dates: readonly DateString[]) {
  const select = useCallback((result: AvailabilityResult) => buildSeatMap(result, dates), [dates]);

  return useQuery({
    queryKey: availabilityKey(slotId, dates),
    queryFn: ({ signal }) => bookingApi.availability({ timeSlotId: slotId!, dates: [...dates] }, signal),
    enabled: slotId !== null && dates.length > 0 && dates.length <= MAX_DATES,
    staleTime: AVAILABILITY_STALE_MS,
    refetchInterval: POLL_MS,
    // "always": coming back to the tab refreshes even if the data is only seconds old. A seat taken while you were
    // away must not look free when you return.
    refetchOnWindowFocus: "always",
    select,
  });
}
