import { Ban, Check, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";

// What each look on the map means. Same shapes as the real seats, small.
const SWATCH = "grid size-6 place-items-center rounded-t-lg rounded-b-md border-2";

export function SeatLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="What the seats mean" className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[0.8125rem] font-medium text-muted", className)}>
      <li className="flex items-center gap-2">
        <span className={cn(SWATCH, "border-brand-300 bg-brand-50")} aria-hidden="true" /> Available
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(SWATCH, "border-leaf-600 bg-leaf-600 text-white")} aria-hidden="true">
          <Check className="size-3.5" strokeWidth={3.5} />
        </span>
        Your seat
      </li>
      <li className="flex items-center gap-2">
        <span
          className={cn(SWATCH, "border-line bg-[repeating-linear-gradient(135deg,var(--color-line)_0_3px,var(--color-canvas)_3px_6px)]")}
          aria-hidden="true"
        />
        Taken
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(SWATCH, "relative border-dashed border-line-strong bg-brand-50")} aria-hidden="true">
          <span className="absolute inset-0 rounded-[inherit] bg-[linear-gradient(135deg,transparent_44%,var(--color-line-strong)_44%_56%,transparent_56%)]" />
        </span>
        Taken on some of your days
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(SWATCH, "border-warn-600/30 bg-warn-50 text-warn-600")} aria-hidden="true">
          <Wrench className="size-3" />
        </span>
        Out of service
      </li>
      <li className="flex items-center gap-2">
        <span className={cn(SWATCH, "border-line bg-canvas text-subtle")} aria-hidden="true">
          <Ban className="size-3" />
        </span>
        Not in use
      </li>
    </ul>
  );
}
