import { Suspense } from "react";
import type { Metadata } from "next";
import { CustomersScreen } from "@/features/staff/components/customers-screen";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}
