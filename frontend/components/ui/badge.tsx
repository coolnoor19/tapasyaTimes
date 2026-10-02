import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold leading-none", {
  variants: {
    tone: {
      neutral: "bg-canvas text-muted ring-1 ring-inset ring-line",
      brand: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
      leaf: "bg-leaf-50 text-leaf-800 ring-1 ring-inset ring-leaf-200",
      warn: "bg-warn-50 text-warn-600 ring-1 ring-inset ring-warn-600/25",
      danger: "bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-600/25",
      // the three seat tiers
      executive: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
      professional: "bg-[#e6f6f7] text-[#0b6f7a] ring-1 ring-inset ring-[#a9dde1]",
      study: "bg-leaf-50 text-leaf-800 ring-1 ring-inset ring-leaf-200",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export interface BadgeProps extends ComponentProps<"span">, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
