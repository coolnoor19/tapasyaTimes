import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// A tidy stand-in for a screen that is built in a later phase.
export function ComingSoon({ icon: Icon, title, description, phase }: { icon: LucideIcon; title: string; description: string; phase: string }) {
  return (
    <div className="flex animate-fade-up flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center [animation-delay:120ms]">
      <span className="grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="size-6" />
      </span>
      <Badge tone="brand">Coming in {phase}</Badge>
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      <p className="max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}
