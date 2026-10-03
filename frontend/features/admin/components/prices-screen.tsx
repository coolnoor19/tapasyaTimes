"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TIERS } from "@/features/landing/content";
import { QueryProblem } from "@/features/staff/components/query-problem";
import { formatPerHour } from "@/lib/money";
import { useSetPrice } from "../hooks/use-admin-mutations";
import { useAdminPrices } from "../hooks/use-admin-queries";
import { describeAdminError } from "../lib/errors";
import { formatWhen } from "../lib/audit-format";
import { paiseToInput, parseRupees } from "../lib/price";
import type { AdminPrice } from "../types";

// The hourly price of each seat tier. ONE request loads all three. A new price applies to FUTURE bookings only: a booking
// keeps the price it was sold at.
export function PricesScreen() {
  const query = useAdminPrices();
  const prices = query.data;
  const missing = prices?.filter((price) => price.pricePerHourPaise === null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Prices" description="What each tier costs per hour. A new price applies to new bookings only; existing bookings keep the price they were sold at." />

      {query.isError && !prices && <QueryProblem error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} what="the prices" />}

      {query.isPending && !query.isError && (
        <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="h-56 rounded-lg" />
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <Alert tone="warn" title={`${missing.length === 1 ? "A tier has" : `${missing.length} tiers have`} no price yet`}>
          Seats in a tier without a price are not offered to customers. Set a price for: {missing.map((price) => TIERS[price.seatType].name).join(", ")}.
        </Alert>
      )}

      {prices && (
        <div className="grid gap-4 lg:grid-cols-3">
          {prices.map((price) => (
            // keyed by the saved value: after a save the card starts again from what the server now holds
            <PriceCard key={`${price.seatType}-${price.pricePerHourPaise}`} price={price} />
          ))}
        </div>
      )}
    </div>
  );
}

function PriceCard({ price }: { price: AdminPrice }) {
  const tier = TIERS[price.seatType];
  const save = useSetPrice();
  const [text, setText] = useState(paiseToInput(price.pricePerHourPaise));
  const [touched, setTouched] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const parsed = parseRupees(text);
  const error = touched && !parsed.ok ? parsed.error : undefined;
  const unchanged = parsed.ok && parsed.paise === price.pricePerHourPaise;

  const submit = () => {
    setTouched(true);
    setProblem(null);
    if (!parsed.ok || unchanged) return;
    save.mutate(
      { seatType: price.seatType, paise: parsed.paise },
      {
        onSuccess: (saved) => toast.success(`${tier.name} is now ${formatPerHour(saved.pricePerHourPaise)}`),
        onError: (failure) => setProblem(describeAdminError(failure)),
      },
    );
  };

  return (
    <Card>
      <CardContent>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">{tier.name}</h2>
              <p className="text-sm text-muted">{tier.tagline}</p>
            </div>
            <Badge tone={price.seatType === "EXECUTIVE" ? "executive" : price.seatType === "PROFESSIONAL" ? "professional" : "study"}>
              {price.pricePerHourPaise === null ? "No price" : formatPerHour(price.pricePerHourPaise)}
            </Badge>
          </div>

          {problem && <Alert tone="danger">{problem}</Alert>}

          <Field label="Price per hour (₹)" error={error} hint="Whole rupees or with paise, like 150 or 150.50.">
            {({ invalid, ...control }) => (
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
                  ₹
                </span>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  onBlur={() => setTouched(true)}
                  invalid={invalid}
                  className="pl-8"
                  {...control}
                />
              </div>
            )}
          </Field>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-subtle">{price.updatedAt ? `Last changed ${formatWhen(price.updatedAt)}` : "Never set"}</p>
            <Button type="submit" size="sm" loading={save.isPending} disabled={unchanged || (touched && !parsed.ok)}>
              Save price
            </Button>
          </div>

          {price.pricePerHourPaise === null && (
            <p className="flex items-start gap-2 text-xs text-warn-600">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Customers can’t book these seats until a price is set.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
