"use client";

import { useEffect } from "react";

// Puts the staff look on <html> while the portal is open. The page itself is wrapped in `.theme-staff`, but dialogs
// and toasts render outside the page tree (in a portal on <body>), so they need the class higher up to match.
export function StaffThemeClass() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("theme-staff");
    return () => root.classList.remove("theme-staff");
  }, []);
  return null;
}
