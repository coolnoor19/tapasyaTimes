"use client";

import { Toaster as Sonner } from "sonner";

// Brief messages ("Booking held for 10 minutes"). Coloured with the brand tokens.
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={16}
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
