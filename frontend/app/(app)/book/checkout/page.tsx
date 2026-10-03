import { Suspense } from "react";
import type { Metadata } from "next";
import { CheckoutPlaceholder } from "@/features/seat-map/components/checkout-placeholder";

export const metadata: Metadata = { title: "Review and pay" };

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutPlaceholder />
    </Suspense>
  );
}
