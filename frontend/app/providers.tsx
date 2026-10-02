"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { SessionBootstrap } from "@/features/auth/components/session-bootstrap";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { makeQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: ReactNode }) {
  // Created once per browser tab. (A module-level client would be shared between visitors on the server.)
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* reducedMotion="user": every `motion` animation obeys the visitor's "reduce motion" setting */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
        <SessionBootstrap />
      </MotionConfig>
    </QueryClientProvider>
  );
}
