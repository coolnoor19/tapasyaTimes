"use client";

import { useQuery } from "@tanstack/react-query";
import { bookingApi, TIME_SLOTS_KEY } from "../api/booking-api";
import { useSession } from "@/features/auth/hooks/use-session";

// The active time slots, earliest first. Only asked for once the visitor is signed in (the endpoint needs a login).
export function useTimeSlots() {
  const { status } = useSession();
  return useQuery({
    queryKey: TIME_SLOTS_KEY,
    queryFn: bookingApi.timeSlots,
    enabled: status === "authenticated",
    staleTime: 60_000,
  });
}
