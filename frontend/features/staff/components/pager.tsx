import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Newer / Older with "Page x of y". `hrefFor(page)` builds the address, so filters in the URL are kept.
export function Pager({ page, pages, total, hrefFor, label }: { page: number; pages: number; total: number; hrefFor: (page: number) => string; label: string }) {
  if (pages <= 1) return <p className="tabular text-sm text-muted">{total} {total === 1 ? "result" : "results"}</p>;
  const current = Math.min(page, pages);
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4">
      <Button asChild variant="secondary" size="sm" className={current <= 1 ? "pointer-events-none opacity-50" : undefined}>
        <Link href={hrefFor(current - 1)} aria-disabled={current <= 1} tabIndex={current <= 1 ? -1 : undefined}>
          <ArrowLeft className="size-4" />
          Previous
        </Link>
      </Button>
      <p className="tabular text-sm text-muted">
        Page {current} of {pages} · {total} results
      </p>
      <Button asChild variant="secondary" size="sm" className={current >= pages ? "pointer-events-none opacity-50" : undefined}>
        <Link href={hrefFor(current + 1)} aria-disabled={current >= pages} tabIndex={current >= pages ? -1 : undefined}>
          Next
          <ArrowRight className="size-4" />
        </Link>
      </Button>
    </nav>
  );
}
