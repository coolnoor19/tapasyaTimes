"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, Menu, X } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/logo";
import { isStaffActive, staffNavFor, type StaffNavGroup, type StaffNavItem } from "@/config/staff-nav";
import { UserMenu } from "@/features/auth/components/user-menu";
import { useSession } from "@/features/auth/hooks/use-session";
import { cn } from "@/lib/cn";

// The frame around every staff page: a sidebar (a slide-in drawer on phones) and a slim top bar with the account menu.
export function StaffShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const groups = user ? staffNavFor(user.role) : [];
  // The drawer is "open for" the page it was opened on, so following a link in it closes it by itself.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const drawerOpen = openOn === pathname;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      {/* wide screens: a fixed sidebar */}
      <aside className="hidden border-r border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col" aria-label="Staff navigation">
        <SidebarContent groups={groups} pathname={pathname} role={user?.role} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6">
          <DialogPrimitive.Root open={drawerOpen} onOpenChange={(open) => setOpenOn(open ? pathname : null)}>
            <DialogPrimitive.Trigger
              aria-label="Open the menu"
              className="grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-brand-50 hover:text-brand-800 lg:hidden"
            >
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-fade-in lg:hidden" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-pop focus:outline-none lg:hidden"
              >
                <DialogPrimitive.Title className="sr-only">Staff menu</DialogPrimitive.Title>
                <DialogPrimitive.Close aria-label="Close the menu" className="absolute right-3 top-4 rounded-md p-1.5 text-subtle hover:bg-brand-50 hover:text-brand-800">
                  <X className="size-5" />
                </DialogPrimitive.Close>
                <SidebarContent groups={groups} pathname={pathname} role={user?.role} />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>

          <Link href={groups[0]?.items[0]?.href ?? "/manager"} className="rounded-md lg:hidden" aria-label="Staff overview">
            <Logo showText={false} />
          </Link>

          <div className="ml-auto">
            <UserMenu signedOutTo="/staff/login" />
          </div>
        </header>

        <main className="flex-1 py-8 sm:py-10">
          <Container className="max-w-7xl">{children}</Container>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({ groups, pathname, role }: { groups: StaffNavGroup[]; pathname: string; role: string | undefined }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
        <Link href="/" className="rounded-md" aria-label="Tapasya Times">
          <Logo className="[&>span:last-child]:text-[1.0625rem]" />
        </Link>
      </div>

      <nav aria-label="Staff" className="flex-1 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.title ?? "top"} className="mb-6 last:mb-0">
            {group.title && <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-subtle">{group.title}</p>}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={isStaffActive(pathname, item.href)} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-line p-4">
        <Link
          href="/book"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-800"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Customer site
        </Link>
        {role && (
          <Badge tone="brand" className="w-fit">
            {role === "ADMIN" ? "Admin" : "Manager"}
          </Badge>
        )}
      </div>
    </>
  );
}

function SidebarLink({ item, active }: { item: StaffNavItem; active: boolean }) {
  const Icon = item.icon;
  const base = "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors";

  if (item.soon) {
    return (
      <span aria-disabled="true" className={cn(base, "cursor-not-allowed text-subtle/70")}>
        <Icon className="size-[1.125rem]" aria-hidden="true" />
        {item.label}
        <span className="ml-auto rounded-full bg-canvas px-2 py-0.5 text-[0.6875rem] font-medium text-subtle ring-1 ring-inset ring-line">Soon</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(base, active ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100" : "text-muted hover:bg-brand-50/60 hover:text-brand-800")}
    >
      <Icon className="size-[1.125rem]" aria-hidden="true" />
      {item.label}
    </Link>
  );
}
