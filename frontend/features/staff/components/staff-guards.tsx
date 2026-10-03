"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthLoadingScreen } from "@/features/auth/components/auth-loading-screen";
import { ServerUnreachable } from "@/features/auth/components/server-unreachable";
import { useSession } from "@/features/auth/hooks/use-session";
import { useSignOut } from "@/features/auth/hooks/use-sign-out";
import { canAccess, destinationAfterLogin, isStaffRole, roleHome, staffLoginUrlFor } from "@/features/auth/lib/redirect";
import { retryBootstrap } from "@/features/auth/session/session-store";

// Like the customer guards, these only decide what a visitor SEES. The data is protected by the backend, which checks
// the token and the role on every request (and has tests proving every /manager and /admin route refuses the wrong caller).

// The staff pages. Signed out -> the staff sign-in (and back here afterwards). A customer -> back to the customer side.
// A manager who types an admin address -> their own home.
export function RequireStaff({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, endedBy } = useSession();
  const allowed = user ? canAccess(user.role, pathname) : false;

  useEffect(() => {
    if (status === "anonymous") {
      if (endedBy === "user") router.replace("/staff/login"); // they chose to leave: no "next", no explanation
      else router.replace(staffLoginUrlFor(pathname + window.location.search, endedBy === "expired" ? "expired" : undefined));
    } else if (status === "authenticated" && user && !allowed) {
      toast.error(isStaffRole(user.role) ? "That page isn’t available for your account." : "That area is for staff only.");
      router.replace(roleHome(user.role));
    }
  }, [status, user, allowed, endedBy, pathname, router]);

  if (status === "unavailable") return <ServerUnreachable onRetry={retryBootstrap} />;
  if (status !== "authenticated" || !allowed) return <AuthLoadingScreen />;
  return <>{children}</>;
}

// The staff sign-in page. Signed-in staff go straight on. A signed-in CUSTOMER must not see a form that would swap
// their session: they are told, and offered a way back or a way to sign out first.
export function StaffGuest({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, user } = useSession();
  const signOut = useSignOut("/staff/login");

  useEffect(() => {
    if (status === "authenticated" && user && isStaffRole(user.role)) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(destinationAfterLogin(user.role, next));
    }
  }, [status, user, router]);

  if (status === "authenticated" && user && isStaffRole(user.role)) return <AuthLoadingScreen label="Taking you in" />;

  if (status === "authenticated" && user) {
    return (
      <Card className="animate-fade-up">
        <CardContent className="flex flex-col gap-5">
          <span className="grid size-12 place-items-center rounded-xl bg-warn-50 text-warn-600">
            <ShieldAlert className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-ink">You’re signed in as {user.firstName}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              The staff portal is for managers and admins. To sign in with a staff account, sign out of this one first.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="secondary" className="sm:flex-1">
              <Link href="/bookings">Go to my bookings</Link>
            </Button>
            <Button className="sm:flex-1" onClick={() => void signOut()}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
