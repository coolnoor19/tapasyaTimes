import type { ReactNode } from "react";
import { AuthShell } from "@/features/auth/components/auth-shell";
import { GuestOnly } from "@/features/auth/components/guards";

// Sign in, register and verify share one frame, and are for visitors only.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <GuestOnly>
      <AuthShell>{children}</AuthShell>
    </GuestOnly>
  );
}
