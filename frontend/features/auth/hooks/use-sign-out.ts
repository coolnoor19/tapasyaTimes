"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "../session/session-store";

// `to` is where the person lands afterwards: the staff portal sends its people back to the staff sign-in.
export function useSignOut(to = "/login") {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await signOut();
    // Everything fetched for this person (bookings, profile...) is dropped, so the next person to use this
    // browser can never see it, not even for a moment.
    queryClient.clear();
    router.replace(to);
  }, [queryClient, router, to]);
}
