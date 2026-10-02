"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { passwordStrength } from "../lib/password-strength";

const BAR_COLOR = ["bg-line", "bg-danger-600", "bg-warn-600", "bg-brand-500", "bg-leaf-500"] as const;
const LABEL_COLOR = ["text-muted", "text-danger-700", "text-warn-600", "text-brand-700", "text-leaf-700"] as const;

// Four bars that fill as the password gets stronger, and a checklist that ticks itself off.
// Advice only: the form accepts any password of 8 to 72 characters.
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, checks } = passwordStrength(password);
  const visible = password.length > 0;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-2.5 pt-2.5">
            <div className="flex items-center gap-3">
              <div className="flex flex-1 gap-1.5" aria-hidden="true">
                {[1, 2, 3, 4].map((segment) => (
                  <span
                    key={segment}
                    className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", score >= segment ? BAR_COLOR[score] : "bg-line")}
                  />
                ))}
              </div>
              <span aria-live="polite" className={cn("min-w-20 text-right text-xs font-semibold transition-colors", LABEL_COLOR[score])}>
                <span className="sr-only">Password strength: </span>
                {label}
              </span>
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {checks.map((check) => (
                <li key={check.id} className={cn("flex items-center gap-2 text-[0.8125rem] transition-colors duration-200", check.ok ? "text-leaf-700" : "text-muted")}>
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded-full border transition-all duration-200",
                      check.ok ? "scale-100 border-leaf-500 bg-leaf-500 text-white" : "border-line-strong",
                    )}
                  >
                    {check.ok && <Check className="size-2.5 animate-pop" strokeWidth={3.5} />}
                  </span>
                  {check.label}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
