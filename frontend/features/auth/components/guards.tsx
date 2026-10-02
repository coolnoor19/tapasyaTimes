"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "../hooks/use-session";
import { canAccess, destinationAfterLogin, loginUrlFor, roleHome } from "../lib/redirect";
import { retryBootstrap } from "../session/session-store";
import { AuthLoadingScreen } from "./auth-loading-screen";
import { ServerUnreachable } from "./server-unreachable";

// These guards decide what a visitor SEES. They are not what protects the data: every backend endpoint checks
// the token and the role itself (and the backend tests prove it). A guard only avoids showing someone a page
// they cannot use.

// Pages for signed-in people. Anonymous visitors are sent to sign in (and brought back afterwards);
// someone whose role does not allow the page is sent to their own home.
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, endedBy } = useSession();
  const allowed = user ? canAccess(user.role, pathname) : false;

  useEffect(() => {
    if (status === "anonymous") {
      if (endedBy === "user") {
        router.replace("/login"); // they chose to leave: no "next", no explanation
      } else {
        router.replace(loginUrlFor(pathname + window.location.search, endedBy === "expired" ? "expired" : undefined));
      }
    } else if (status === "authenticated" && user && !allowed) {
      toast.error("That page isn’t available for your account.");
      router.replace(roleHome(user.role));
    }
  }, [status, user, allowed, endedBy, pathname, router]);

  if (status === "unavailable") return <ServerUnreachable onRetry={retryBootstrap} />;
  if (status !== "authenticated" || !allowed) return <AuthLoadingScreen />;
  return <>{children}</>;
}

// Sign in / register / verify. Already signed in? Nothing to do here: go to the app.
// While the session is still being checked the page shows normally (visitors are the common case),
// and is replaced if it turns out they are signed in.
export function GuestOnly({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, user } = useSession();

  useEffect(() => {
    if (status === "authenticated" && user) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(destinationAfterLogin(user.role, next));
    }
  }, [status, user, router]);

  if (status === "authenticated") return <AuthLoadingScreen label="Taking you in" />;
  return <>{children}</>;
}
