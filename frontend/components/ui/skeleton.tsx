import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// A grey shape that shimmers while real content loads. Same size as the content it stands in for,
// so nothing jumps when the data arrives.
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-line)_25%,var(--color-canvas)_50%,var(--color-line)_75%)] bg-[length:200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
