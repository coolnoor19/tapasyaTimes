"use client";

import { useEffect, useState } from "react";

// Counts down the seconds left until `startedAt + durationMs`. Used for "Resend code in 0:42".
// The backend also enforces the wait (silently), so this exists to tell the person why nothing would happen.
export function useCooldown(startedAt: number | null, durationMs: number) {
  // The clock is the only state; the remaining seconds are worked out from it while rendering.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // catch up straight away when a new countdown starts
    const timer = setInterval(tick, 500);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [startedAt]);

  if (startedAt === null) return 0;
  // Capped at the full duration: right after a restart the clock may still hold an old reading for a moment.
  return Math.min(Math.ceil(durationMs / 1000), Math.max(0, Math.ceil((startedAt + durationMs - now) / 1000)));
}

// 42 -> "0:42", 75 -> "1:15"
export const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
