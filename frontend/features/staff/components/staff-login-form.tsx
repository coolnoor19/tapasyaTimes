"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import type { z } from "zod";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { authApi } from "@/features/auth/api/auth-api";
import { describeLoginError, type FormProblem } from "@/features/auth/lib/errors";
import { destinationAfterLogin, isStaffRole } from "@/features/auth/lib/redirect";
import { loginSchema } from "@/features/auth/schemas/auth-schemas";
import { setSession } from "@/features/auth/session/session-store";

type FormInput = z.input<typeof loginSchema>;
type FormOutput = z.output<typeof loginSchema>;

// The right password, but for an account that is not staff.
class NotStaffError extends Error {
  constructor() {
    super("not staff");
    this.name = "NotStaffError";
  }
}

export function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const sessionExpired = params.get("reason") === "expired";

  const [problem, setProblem] = useState<FormProblem | { tone: "warn"; message: string; kind: "not-staff" } | null>(null);
  const [attempt, setAttempt] = useState(0); // changes on every failure so the message plays its shake again

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" }, mode: "onTouched" });

  useEffect(() => setFocus("email"), [setFocus]);

  const login = useMutation({
    mutationFn: async (values: FormOutput) => {
      const auth = await authApi.login(values);
      if (!isStaffRole(auth.user.role)) {
        // The sign-in worked, so the browser now holds a refresh cookie for a CUSTOMER. Nothing was stored in this tab:
        // end that session at once, so a customer who tried the staff page is left exactly as they were.
        await authApi.logout().catch(() => undefined);
        throw new NotStaffError();
      }
      return auth;
    },
    onSuccess: (auth) => {
      setSession(auth);
      toast.success(`Welcome, ${auth.user.firstName}`);
      router.replace(destinationAfterLogin(auth.user.role, next));
    },
    onError: (error) => {
      setProblem(error instanceof NotStaffError ? { tone: "warn", kind: "not-staff", message: "This sign-in is for staff only. Customers sign in on the main site." } : describeLoginError(error));
      setAttempt((count) => count + 1);
    },
  });

  // Stay "busy" after success too, until the next page replaces this one: no second click, no flicker.
  const busy = login.isPending || login.isSuccess;

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink">Staff sign in</h1>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-muted">For managers and admins. Customers sign in on the main site.</p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setProblem(null);
          login.mutate(values);
        })}
        className="flex flex-col gap-5"
      >
        <AnimatePresence initial={false}>
          {sessionExpired && !problem && (
            <Alert key="expired" tone="info" title="You were signed out">
              Your session ended, so please sign in again to continue.
            </Alert>
          )}
          {problem && (
            <Alert
              key={`problem-${attempt}`}
              tone={problem.tone}
              shake
              action={
                "kind" in problem && problem.kind === "not-staff" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/login">Go to customer sign in</Link>
                  </Button>
                ) : undefined
              }
            >
              {problem.message}
            </Alert>
          )}
        </AnimatePresence>

        <Field label="Work email" error={errors.email?.message}>
          {({ invalid, ...control }) => <Input type="email" autoComplete="email" inputMode="email" placeholder="name@company.com" invalid={invalid} {...control} {...register("email")} />}
        </Field>

        <Field label="Password" error={errors.password?.message}>
          {({ invalid, ...control }) => <PasswordInput autoComplete="current-password" placeholder="Your password" invalid={invalid} {...control} {...register("password")} />}
        </Field>

        <Button type="submit" size="lg" loading={busy} className="w-full">
          {busy ? "Signing you in" : "Sign in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Not staff?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Customer sign in
        </Link>
      </p>
    </>
  );
}
