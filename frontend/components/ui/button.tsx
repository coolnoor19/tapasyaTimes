import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold",
    "transition-[transform,background-color,box-shadow,border-color,color] duration-150 ease-out",
    // a tiny press: the button sinks under the finger
    "active:scale-[0.97] active:duration-75",
    "focus-visible:outline-none focus-visible:shadow-ring",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        primary: "bg-action text-white shadow-sm hover:bg-action-hover hover:shadow-md",
        accent: "bg-accent text-white shadow-sm hover:bg-accent-hover hover:shadow-md",
        secondary: "border border-line-strong bg-surface text-ink hover:border-brand-300 hover:bg-brand-50",
        ghost: "text-muted hover:bg-brand-50 hover:text-brand-800",
        danger: "bg-danger-solid text-white shadow-sm hover:bg-danger-solid-hover",
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-[0.9375rem]",
        lg: "h-13 px-7 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  // Shows a spinner and blocks repeat clicks (a double-click must never submit twice)
  loading?: boolean;
  // Render as the child element (for example a <Link>) with the button's look
  asChild?: boolean;
}

export function Button({ className, variant, size, loading = false, asChild = false, children, disabled, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <Spinner className="size-4" label="Please wait" />}
      {children}
    </button>
  );
}
