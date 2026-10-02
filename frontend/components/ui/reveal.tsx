import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Fades its content up into place. Give consecutive blocks 0, 1, 2... as `index` and they arrive one after
// another, which makes a form feel composed instead of dropped on the page. Pure CSS: no JavaScript needed,
// and switched off by the reduced-motion rule in globals.css.
export function Reveal({ index = 0, className, style, ...props }: ComponentProps<"div"> & { index?: number }) {
  return <div className={cn("animate-fade-up", className)} style={{ animationDelay: `${index * 70}ms`, ...style }} {...props} />;
}
