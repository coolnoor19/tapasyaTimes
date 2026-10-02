"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "danger" | "warn" | "success" | "info";

const STYLES: Record<Tone, { box: string; icon: string; Icon: LucideIcon }> = {
  danger: { box: "border-danger-600/25 bg-danger-50 text-danger-700", icon: "text-danger-600", Icon: CircleAlert },
  warn: { box: "border-warn-600/25 bg-warn-50 text-warn-600", icon: "text-warn-600", Icon: TriangleAlert },
  success: { box: "border-leaf-300 bg-leaf-50 text-leaf-800", icon: "text-leaf-600", Icon: CircleCheck },
  info: { box: "border-brand-200 bg-brand-50 text-brand-800", icon: "text-brand-600", Icon: Info },
};

interface AlertProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  // A button or link that resolves the problem ("Verify email")
  action?: ReactNode;
  // Plays a short side-to-side shake as it appears: for "that did not work" feedback
  shake?: boolean;
  className?: string;
}

// An inline message that slides in. Errors are announced to screen readers at once (role="alert").
export function Alert({ tone = "info", title, children, action, shake = false, className }: AlertProps) {
  const { box, icon, Icon } = STYLES[tone];
  return (
    <motion.div
      role={tone === "danger" || tone === "warn" ? "alert" : "status"}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn("flex gap-3 rounded-md border p-3.5 text-sm", box, shake && "animate-shake", className)}
    >
      <Icon className={cn("mt-0.5 size-[1.125rem] shrink-0", icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("leading-relaxed", title && "mt-0.5")}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </motion.div>
  );
}
