"use client";

import { useSyncExternalStore } from "react";

// True while the screen matches a CSS media query, e.g. useMediaQuery("(min-width: 1024px)").
// The server cannot know the screen, so it answers false and the browser corrects it straight after.
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
