"use client";

import { useQuery } from "@tanstack/react-query";
import { authApi } from "../api/auth-api";
import { useSession } from "./use-session";

// GET /auth/me. Only asked for while signed in, and keyed by user so one person never sees another's cached data.
export function useProfile() {
  const { status, user } = useSession();
  return useQuery({
    queryKey: ["auth", "me", user?.id],
    queryFn: authApi.me,
    enabled: status === "authenticated",
  });
}
