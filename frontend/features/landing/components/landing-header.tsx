"use client";

import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/ui/logo";
import { useSession } from "@/features/auth/hooks/use-session";
import { roleHome } from "@/features/auth/lib/redirect";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#seats", label: "Seats & prices" },
  { href: "#hours", label: "Hours" },
  { href: "#faq", label: "FAQ" },
];

export function LandingHeader() {
  const { status, user } = useSession();
  const signedIn = status === "authenticated" && user;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-surface/80 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="rounded-md" aria-label="Tapasya Times home">
          <Logo />
        </Link>

        <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-brand-50 hover:text-brand-800">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm">
              <Link href={roleHome(user.role)}>
                Open my space
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Get started</Link>
              </Button>
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Open menu" className="grid size-10 place-items-center rounded-md text-muted transition-colors hover:bg-brand-50 hover:text-brand-800 data-[state=open]:bg-brand-50 md:hidden">
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-52">
              {LINKS.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <a href={link.href}>{link.label}</a>
                </DropdownMenuItem>
              ))}
              {!signedIn && (
                <DropdownMenuItem asChild>
                  <Link href="/login">Sign in</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Container>
    </header>
  );
}
