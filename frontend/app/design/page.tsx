import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Showcase } from "@/features/design-system/components/showcase";

export const metadata: Metadata = { title: "Style guide", robots: { index: false, follow: false } };

// An internal page for reviewing the design system. Hidden in production unless explicitly enabled.
export default function DesignPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DESIGN_PAGE !== "1") notFound();
  return <Showcase />;
}
