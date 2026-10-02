import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends ComponentProps<"input"> {
  invalid?: boolean;
}

export function Input({ className, invalid = false, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-md border bg-surface px-3.5 text-[0.9375rem] text-ink placeholder:text-subtle",
        "transition-[border-color,box-shadow] duration-150",
        "hover:border-brand-300 focus-visible:border-brand-500 focus-visible:shadow-ring focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-subtle",
        invalid ? "border-danger-600 hover:border-danger-600 focus-visible:border-danger-600" : "border-line-strong",
        className,
      )}
      {...props}
    />
  );
}
