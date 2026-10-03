import type { Metadata } from "next";
import { Overview } from "@/features/staff/components/overview";

export const metadata: Metadata = { title: "Admin overview" };

// Admins land on the same overview as managers (plus shortcuts to the admin tools).
export default function AdminPage() {
  return <Overview />;
}
