import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Joins class names and lets a later Tailwind class win over an earlier one:
// cn("px-2", cond && "px-4")  ->  "px-4"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
