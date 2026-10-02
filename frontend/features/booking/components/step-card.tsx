import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

// One numbered step of the booking page. The number turns into a green tick once the step is done.
export function StepCard({ number, title, done, hint, children }: { number: number; title: string; done: boolean; hint?: string; children: ReactNode }) {
  return (
    <Card className="animate-fade-up" style={{ animationDelay: `${number * 60}ms` }}>
      <div className="p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full font-display text-sm font-bold transition-colors duration-300",
              done ? "bg-leaf-600 text-white" : "bg-brand-100 text-brand-800",
            )}
          >
            {done ? <Check className="size-4.5 animate-pop" strokeWidth={3} /> : number}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink">
              <span className="sr-only">Step {number}: </span>
              {title}
            </h2>
            {hint && <p className="text-sm text-muted">{hint}</p>}
          </div>
        </div>
        {children}
      </div>
    </Card>
  );
}
