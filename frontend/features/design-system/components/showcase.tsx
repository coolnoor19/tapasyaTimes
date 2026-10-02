"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Check, Info } from "lucide-react";
import { Container } from "@/components/layout/container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDateList } from "@/lib/dates";
import { formatPerHour, formatRupees } from "@/lib/money";

const BRAND = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => ({ name: `brand-${n}` }));
const LEAF = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => ({ name: `leaf-${n}` }));
// Tailwind only generates classes it can see written out in full, so each swatch class is spelled out here.
const BRAND_CLASSES: Record<string, string> = {
  "brand-50": "bg-brand-50", "brand-100": "bg-brand-100", "brand-200": "bg-brand-200", "brand-300": "bg-brand-300",
  "brand-400": "bg-brand-400", "brand-500": "bg-brand-500", "brand-600": "bg-brand-600", "brand-700": "bg-brand-700",
  "brand-800": "bg-brand-800", "brand-900": "bg-brand-900", "brand-950": "bg-brand-950",
  "leaf-50": "bg-leaf-50", "leaf-100": "bg-leaf-100", "leaf-200": "bg-leaf-200", "leaf-300": "bg-leaf-300",
  "leaf-400": "bg-leaf-400", "leaf-500": "bg-leaf-500", "leaf-600": "bg-leaf-600", "leaf-700": "bg-leaf-700",
  "leaf-800": "bg-leaf-800", "leaf-900": "bg-leaf-900",
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatches({ items }: { items: { name: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-11">
      {items.map((item) => (
        <div key={item.name} className="flex flex-col gap-1.5">
          <div className={`h-14 rounded-md border border-line ${BRAND_CLASSES[item.name] ?? ""}`} />
          <span className="text-[0.6875rem] text-muted">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export function Showcase() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const emailError = submitted && !/^\S+@\S+\.\S+$/.test(email) ? "Enter a valid email address" : undefined;

  function fakeSave() {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Saved", { description: "This is how confirmations will look." });
    }, 1200);
  }

  return (
    <main className="py-12">
      <Container className="flex flex-col gap-14">
        <div className="flex flex-col gap-6">
          <Logo />
          <PageHeader title="Style guide" description="Every colour, type style and component the app is built from. Review it here before it appears on real screens." />
        </div>

        <Section title="Colour" description="Blue gives structure and trust. Green means success and “yours”: a selected seat, a confirmed booking.">
          <Swatches items={BRAND} />
          <Swatches items={LEAF} />
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-2"><i className="size-4 rounded bg-tier-executive" />Executive</span>
            <span className="flex items-center gap-2"><i className="size-4 rounded bg-tier-professional" />Professional</span>
            <span className="flex items-center gap-2"><i className="size-4 rounded bg-tier-study" />Study</span>
          </div>
        </Section>

        <Section title="Type" description="Plus Jakarta Sans for headings, Inter for everything else. Numbers line up in columns.">
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="font-display text-4xl font-bold">Reserve your seat</p>
              <p className="font-display text-2xl font-semibold">Pick your dates, then your seat</p>
              <p className="text-base">Body text is Inter at 16px: calm, readable and neutral for long forms and tables.</p>
              <p className="text-sm text-muted">Secondary text, for hints and descriptions.</p>
              <p className="tabular text-lg font-semibold">
                {formatRupees(15000)} · {formatPerHour(10000)} · {formatRupees(45050)} · {formatRupees(123456700)}
              </p>
              <p className="tabular text-sm text-muted">{formatDateList(["2026-08-11", "2026-08-12", "2026-08-13", "2026-08-15"])}</p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Buttons" description="Press one: it sinks slightly. Loading blocks a double click.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Continue</Button>
            <Button variant="accent">Confirm booking</Button>
            <Button variant="secondary">Back</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="danger">Remove</Button>
            <Button disabled>Disabled</Button>
            <Button loading={loading} onClick={fakeSave}>
              {loading ? "Saving" : "Click to save"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Section>

        <Section title="Forms" description="Errors slide in under the field and are announced to screen readers.">
          <Card className="max-w-md">
            <CardContent>
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSubmitted(true);
                }}
              >
                <Field label="Email" hint="We send your booking confirmation here." error={emailError}>
                  {({ invalid, ...control }) => (
                    <Input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} invalid={invalid} {...control} />
                  )}
                </Field>
                <Button type="submit">Submit</Button>
              </form>
            </CardContent>
          </Card>
        </Section>

        <Section title="Badges" description="Each seat tier keeps its colour everywhere.">
          <div className="flex flex-wrap gap-2.5">
            <Badge tone="executive">Executive</Badge>
            <Badge tone="professional">Professional</Badge>
            <Badge tone="study">Study</Badge>
            <Badge tone="leaf"><Check className="size-3" />Confirmed</Badge>
            <Badge tone="warn">Pending payment</Badge>
            <Badge tone="danger">Expired</Badge>
            <Badge>Cancelled</Badge>
          </div>
        </Section>

        <Section title="Cards, loading and overlays">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Seat A01</CardTitle>
                <CardDescription>Executive · Floor 1</CardDescription>
              </CardHeader>
              <CardContent className="tabular text-2xl font-bold text-brand-800">{formatPerHour(15000)}</CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col gap-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <p className="text-xs text-subtle">Skeleton while loading</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-wrap items-start gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary" size="sm">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogTitle>Release this booking?</DialogTitle>
                    <DialogDescription>The seat becomes available to others straight away.</DialogDescription>
                    <div className="mt-6 flex justify-end gap-3">
                      <DialogClose asChild>
                        <Button variant="ghost" size="sm">Keep it</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button variant="danger" size="sm">Release</Button>
                      </DialogClose>
                    </div>
                  </DialogContent>
                </Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm"><Info className="size-4" />Hover me</Button>
                  </TooltipTrigger>
                  <TooltipContent>Seat taken on 12 Aug</TooltipContent>
                </Tooltip>
                <Button variant="secondary" size="sm" onClick={() => toast("Seat held for 10 minutes", { description: "Complete payment to confirm." })}>
                  Show toast
                </Button>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section title="Motion" description="Short, soft and purposeful. Switched off for anyone who prefers reduced motion.">
          <div className="flex flex-wrap gap-3">
            {["Pick dates", "Choose a seat", "Pay", "Walk in"].map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -3 }}
                className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium shadow-card"
              >
                <span className="grid size-6 place-items-center rounded-full bg-leaf-100 text-xs font-bold text-leaf-800">{index + 1}</span>
                {step}
              </motion.div>
            ))}
          </div>
        </Section>
      </Container>
    </main>
  );
}
