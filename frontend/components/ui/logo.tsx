import { cn } from "@/lib/cn";
import { siteConfig } from "@/config/site";

// A rounded square (blue into green) holding a simple seat. The text part can be hidden for tight spaces.
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id="tt-logo-gradient" x1="3" y1="3" x2="29" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#1f58d8" />
          <stop offset="1" stopColor="#0a9a5a" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#tt-logo-gradient)" />
      {/* seat back, seat cushion, legs */}
      <path d="M11 8.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2V15H11V8.5Z" fill="#fff" />
      <rect x="9" y="16.5" width="14" height="4.5" rx="2" fill="#fff" fillOpacity="0.92" />
      <path d="M12 22.5v3M20 22.5v3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {showText && <span className="font-display text-lg font-bold tracking-tight text-ink">{siteConfig.name}</span>}
    </span>
  );
}
