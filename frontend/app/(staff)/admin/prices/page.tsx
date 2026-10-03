import type { Metadata } from "next";
import { PricesScreen } from "@/features/admin/components/prices-screen";

export const metadata: Metadata = { title: "Prices" };

export default function AdminPricesPage() {
  return <PricesScreen />;
}
