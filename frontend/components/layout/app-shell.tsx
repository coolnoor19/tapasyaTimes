"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { Container } from "@/components/layout/container";
import { Logo } from "@/components/ui/logo";
import { isActive, navFor } from "@/config/nav";
import { useSession } from "@/features/auth/hooks/use-session";
import { roleHome } from "@/features/auth/lib/redirect";
import { UserMenu } from "@/features/auth/components/user-menu";
import { cn } from "@/lib/cn";

// The frame around every signed-in page: a sticky header with the logo, the links this person may use, and their menu.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const items = user ? navFor(user.role) : [];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
        <Container className="flex h-16 items-center gap-6">
          <Link href={user ? roleHome(user.role) : "/"} className="shrink-0 rounded-md" aria-label="Tapasya Times home">
            <Logo className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </Link>

          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </nav>

          <div className="ml-auto md:ml-0">
            <UserMenu />
          </div>
        </Container>

        {/* phones: the same links in a row under the header */}
        <nav aria-label="Main" className="border-t border-line md:hidden">
          <Container className="flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} compact />
            ))}
          </Container>
        </nav>
      </header>

      <main className="flex-1 py-8 sm:py-10">
        <Container>{children}</Container>
      </main>
    </div>
  );
}

function NavLink({ item, active, compact = false }: { item: ReturnType<typeof navFor>[number]; active: boolean; compact?: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        active ? "text-brand-800" : "text-muted hover:bg-brand-50 hover:text-brand-800",
      )}
    >
      {/* one highlight that slides between links instead of jumping */}
      {active && (
        <motion.span
          layoutId={compact ? "nav-pill-compact" : "nav-pill"}
          className="absolute inset-0 rounded-md bg-brand-50 ring-1 ring-inset ring-brand-100"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <Icon className="relative size-4" />
      <span className="relative">{item.label}</span>
    </Link>
  );
}
