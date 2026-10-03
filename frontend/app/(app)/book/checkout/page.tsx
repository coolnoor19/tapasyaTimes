import { Suspense } from "react";
import type { Metadata } from "next";
import { Checkout } from "@/features/checkout/components/checkout";

export const metadata: Metadata = { title: "Review and reserve" };

export default function CheckoutPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
