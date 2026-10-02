import type { ReactNode } from "react";
import Link from "next/link";
import { Armchair, CalendarRange, Timer } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { siteConfig } from "@/config/site";
import { SeatPreview } from "./seat-preview";

const POINTS = [
  { Icon: CalendarRange, text: "Pick one day or a whole month, whatever your work needs." },
  { Icon: Armchair, text: "See the live seat map and choose your exact seat." },
  { Icon: Timer, text: "Your seat is held for 10 minutes while you check out." },
];

// The frame around sign in / register / verify: a brand panel with a taste of the product on wide screens,
// and just the form on a phone.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[5fr_6fr]">
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(155deg,var(--color-brand-950),var(--color-brand-800)_55%,var(--color-leaf-800))] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* soft light blobs for depth */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 size-[28rem] rounded-full bg-leaf-500/25 blur-3xl" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,#fff_1px,transparent_1px)] [background-size:22px_22px]"
        />

        <Link href="/" className="relative w-fit rounded-md focus-visible:outline-white">
          <Logo tone="light" />
        </Link>

        <div className="relative flex flex-col gap-12">
          <SeatPreview />
          <div className="max-w-md">
            <h2 className="text-3xl font-bold leading-tight xl:text-[2.125rem]">Reserve your focus, one seat at a time.</h2>
            <ul className="mt-6 flex flex-col gap-3.5">
              {POINTS.map(({ Icon, text }) => (
                <li key={text} className="flex items-start gap-3 text-[0.9375rem] text-white/80">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-white/12 text-leaf-300">
                    <Icon className="size-4" />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="relative text-xs text-white/45">© {new Date().getFullYear()} {siteConfig.name}</p>
      </aside>

      <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-16">
        <Link href="/" className="w-fit rounded-md lg:hidden">
          <Logo />
        </Link>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-start py-10 sm:justify-center">{children}</main>
      </div>
    </div>
  );
}

// Title and one line under it, the same on every auth page.
export function AuthHeading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}
