"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api/client";
import type { PublicOverview } from "../types";

// What the landing page shows from the server: live prices, seat counts and opening slots.
// One request is shared by every section that calls this hook. A change an admin makes appears within minutes.
export function useOverview() {
  return useQuery({
    queryKey: ["public", "overview"],
    queryFn: () => apiRequest<PublicOverview>("/public/overview", { auth: false }),
    staleTime: 5 * 60_000,
    // A visitor should not stare at a skeleton for long when the server is down: one quick retry, then say so.
    retry: 1,
  });
}
