"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "../hooks/use-session";
import { roleHome } from "../lib/redirect";

// The buttons on the home page: sign in / create an account, or straight back into the app.
export function HomeActions() {
  const { status, user } = useSession();

  if (status === "authenticated" && user) {
    return (
      <Button asChild size="lg">
        <Link href={roleHome(user.role)}>
          Continue as {user.firstName}
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Button asChild size="lg">
        <Link href="/register">Create an account</Link>
      </Button>
      <Button asChild size="lg" variant="secondary">
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}
