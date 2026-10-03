import type { ReactNode } from "react";
import { StaffShell } from "@/components/layout/staff-shell";
import { RequireStaff } from "@/features/staff/components/staff-guards";
import { StaffThemeClass } from "@/features/staff/components/staff-theme";

// Everything for managers and admins: the dark staff look, the staff guard and the sidebar shell. The guard decides what
// is shown; the backend decides what is allowed.
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-staff min-h-dvh">
      <StaffThemeClass />
      <RequireStaff>
        <StaffShell>{children}</StaffShell>
      </RequireStaff>
    </div>
  );
}
