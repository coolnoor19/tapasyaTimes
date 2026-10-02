"use client";

import { useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";

// What the control inside a Field must receive so a screen reader announces label, hint and error.
export interface FieldControlProps {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  invalid: boolean;
}

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | undefined;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

// Label + control + hint + error as one unit:
//   <Field label="Email" error={errors.email?.message}>{(c) => <Input type="email" {...c} />}</Field>
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-[0.8125rem] text-muted">
          {hint}
        </p>
      )}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.18 }}
            className="text-[0.8125rem] font-medium text-danger-700"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
