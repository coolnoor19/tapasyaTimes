import { Skeleton } from "@/components/ui/skeleton";

// Shown only on a cold start (nothing in the cache yet): the shape of the plan, so the page does not jump when it arrives.
export function SeatMapSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the seat map" className="flex flex-col items-center gap-9">
      <Skeleton className="h-8 w-3/5 max-w-sm rounded-full" />
      {[6, 6].map((seats, section) => (
        <div key={section} className="flex flex-col gap-3">
          <Skeleton className="mb-1 h-5 w-48" />
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-2">
              <Skeleton className="h-4 w-7" />
              {Array.from({ length: seats }, (_, seat) => (
                <Skeleton key={seat} className="size-11 rounded-t-[0.95rem] rounded-b-lg sm:size-12" />
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
