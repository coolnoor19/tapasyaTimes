"use client";

import { Toaster as Sonner } from "sonner";

// Brief messages ("Booking held for 10 minutes"). Coloured with the brand tokens.
// Top right and below the sticky header, so a toast never covers the navigation; bottom edges stay free for
// the seat map's booking bar.
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      offset={{ top: 76, right: 20 }}
      mobileOffset={{ top: 72, left: 16, right: 16 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-line !bg-surface !text-ink !shadow-pop !font-sans",
          description: "!text-muted",
          success: "[&_[data-icon]]:!text-leaf-600",
          error: "[&_[data-icon]]:!text-danger-600",
        },
      }}
    />
  );
}
