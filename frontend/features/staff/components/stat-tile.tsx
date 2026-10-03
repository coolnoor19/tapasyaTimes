import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";

// One headline number: label, value, and one line of context. Proportional figures for the big value (tabular only
// belongs in columns).
export function StatTile({ icon, label, value, hint, tone = "brand", loading = false }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: "brand" | "leaf" | "warn" | "danger"; loading?: boolean }) {
  const tones = { brand: "bg-brand-50 text-brand-700", leaf: "bg-leaf-50 text-leaf-700", warn: "bg-warn-50 text-warn-600", danger: "bg-danger-50 text-danger-600" } as const;
  return (
    <Card>
      <CardContent className="flex items-start gap-4 !p-5">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", tones[tone])} aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted">{label}</p>
          {loading ? <Skeleton className="mt-1.5 h-8 w-20" /> : <p className="font-display text-3xl font-bold leading-tight text-ink">{value}</p>}
          {hint && !loading && <p className="mt-0.5 text-[0.8125rem] text-subtle">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
