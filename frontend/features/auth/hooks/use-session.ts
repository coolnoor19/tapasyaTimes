"use client";

import { useSyncExternalStore } from "react";
import { getServerSnapshot, getSnapshot, subscribe } from "../session/session-store";

// The current session. Re-renders the component whenever it changes (sign in, refresh failure, sign out).
export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
