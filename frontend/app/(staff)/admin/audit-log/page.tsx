import { Suspense } from "react";
import type { Metadata } from "next";
import { AuditScreen } from "@/features/admin/components/audit-screen";

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAuditLogPage() {
  return (
    <Suspense>
      <AuditScreen />
    </Suspense>
  );
}
