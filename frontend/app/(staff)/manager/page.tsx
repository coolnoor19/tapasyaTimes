import type { Metadata } from "next";
import { Overview } from "@/features/staff/components/overview";

export const metadata: Metadata = { title: "Overview" };

export default function ManagerPage() {
  return <Overview />;
}
