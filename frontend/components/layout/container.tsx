import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Keeps page content a readable width with even side gutters (16px on phones, wider on desktop).
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)} {...props} />;
}
