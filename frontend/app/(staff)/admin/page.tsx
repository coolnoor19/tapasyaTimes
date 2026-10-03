import type { Metadata } from "next";
import { Overview } from "@/features/staff/components/overview";

export const metadata: Metadata = { title: "Admin overview" };

// Admins land on the same overview as managers (plus a note about the admin tools that arrive next).
export default function AdminPage() {
  return <Overview />;
}
