import type { Metadata } from "next";
import { CustomerDetail } from "@/features/staff/components/customer-detail";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/manager/customers/[id]">) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}
