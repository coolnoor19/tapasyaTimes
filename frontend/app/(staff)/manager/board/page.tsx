import { Suspense } from "react";
import type { Metadata } from "next";
import { BoardScreen } from "@/features/staff/components/board-screen";

export const metadata: Metadata = { title: "Floor board" };

// useSearchParams (?date=, ?slot=) needs a Suspense boundary on a prerendered page.
export default function BoardPage() {
  return (
    <Suspense>
      <BoardScreen />
    </Suspense>
  );
}
