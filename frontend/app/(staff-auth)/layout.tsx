import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { StaffGuest } from "@/features/staff/components/staff-guards";
import { StaffThemeClass } from "@/features/staff/components/staff-theme";

// The staff sign-in: dark, centred, and plainly marked as the staff side so nobody mistakes it for the customer page.
export default function StaffAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="theme-staff relative flex min-h-dvh flex-col overflow-hidden px-4 py-6 sm:px-10">
      <StaffThemeClass />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-brand-500/15 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-24 size-[30rem] rounded-full bg-leaf-500/10 blur-3xl" />

      <header className="relative flex items-center justify-between">
        <Link href="/" className="rounded-md" aria-label="Tapasya Times home">
          <Logo />
        </Link>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-800 ring-1 ring-inset ring-brand-200">Staff portal</span>
      </header>

      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
        <StaffGuest>{children}</StaffGuest>
      </main>
    </div>
  );
}
