"use client";

import { useEffect, useState } from "react";
import { nowInIndia } from "@/lib/dates";
import type { IndiaNow } from "../lib/selection";

// Today's date and the time of day in India, kept current while the page stays open: a slot that starts, or
// midnight passing, changes which days can be booked. Resolution is one minute (slots start on whole minutes).
const read = (): IndiaNow => {
  const { date, time } = nowInIndia();
  return { date, time: `${time.slice(0, 5)}:00` };
};

export function useIndiaNow(): IndiaNow {
  const [now, setNow] = useState(read);

  useEffect(() => {
    const update = () =>
      setNow((previous) => {
        const next = read();
        return previous.date === next.date && previous.time === next.time ? previous : next; // no re-render when nothing changed
      });
    const timer = setInterval(update, 15_000);
    // A laptop that slept: timers pause, so catch up the moment the tab is visible again.
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return now;
}
