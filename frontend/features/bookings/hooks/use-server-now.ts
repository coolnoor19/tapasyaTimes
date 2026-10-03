"use client";

import { useEffect, useState } from "react";
import { serverNow } from "@/lib/api/client";

// The current time by the SERVER's clock (see lib/api/client.ts), refreshed every `intervalMs`. A hold countdown must
// follow the server, and must catch up at once when a laptop wakes from sleep or the tab comes back to the front.
export function useServerNow(intervalMs = 1000): number {
  const [now, setNow] = useState(serverNow);

  useEffect(() => {
    const tick = () => setNow(serverNow());
    tick(); // the offset may have been learned since the first render
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);

  return now;
}
