"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "../session/session-store";

export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await signOut();
    // Everything fetched for this person (bookings, profile...) is dropped, so the next person to use this
    // browser can never see it, not even for a moment.
    queryClient.clear();
    router.replace("/login");
  }, [queryClient, router]);
}
