"use client";

import { keepPreviousData, useQueries, useQuery } from "@tanstack/react-query";
import { datesInMonth, type DateString, type MonthKey } from "@/lib/dates";
import { availabilityKey, bookingApi } from "../api/booking-api";
import { freeSeatsByDate } from "../lib/availability-math";
import { isBookableDay, MAX_DATES, type IndiaNow } from "../lib/selection";
import type { TimeSlot } from "../types";

// Availability changes with every booking anyone makes, so it is refreshed when the tab regains focus
// and treated as stale after a few seconds.
const STALE_MS = 15_000;

// The question the seat map will ask: which seats are free on ALL of these days in this slot.
// While a new selection loads, the previous answer stays visible (marked as a placeholder) instead of blinking away.
export function useSelectionAvailability(slotId: string | null, dates: readonly DateString[]) {
  return useQuery({
    queryKey: availabilityKey(slotId, dates),
    queryFn: ({ signal }) => bookingApi.availability({ timeSlotId: slotId!, dates: [...dates] }, signal),
    enabled: slotId !== null && dates.length > 0 && dates.length <= MAX_DATES,
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });
}

// For the calendar: how many seats are free on each bookable day of the visible months.
// One request per month (a month never has more than the 31 days one request may carry).
export function useMonthAvailability(slot: TimeSlot | null, months: readonly MonthKey[], now: IndiaNow) {
  const queries = useQueries({
    queries: months.map((month) => {
      // Past days (and today, once the slot has started) cannot be asked about: the backend refuses them.
      const dates = slot ? datesInMonth(month).filter((date) => isBookableDay(date, slot.startTime, now)) : [];
      return {
        queryKey: availabilityKey(slot?.id ?? null, dates),
        queryFn: ({ signal }: { signal: AbortSignal }) => bookingApi.availability({ timeSlotId: slot!.id, dates }, signal),
        enabled: slot !== null && dates.length > 0,
        staleTime: STALE_MS,
      };
    }),
  });

  const freeByDate: Record<DateString, number> = {};
  for (const query of queries) {
    if (query.data) Object.assign(freeByDate, freeSeatsByDate(query.data.seats, query.data.dates));
  }

  return {
    freeByDate,
    isLoading: queries.some((query) => query.isFetching && !query.data),
    isError: queries.some((query) => query.isError),
    refetch: () => queries.forEach((query) => void query.refetch()),
  };
}
