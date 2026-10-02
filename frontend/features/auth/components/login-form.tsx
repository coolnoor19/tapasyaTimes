"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { z } from "zod";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Reveal } from "@/components/ui/reveal";
import { authApi } from "../api/auth-api";
import { describeLoginError, type FormProblem } from "../lib/errors";
import { clearPrefillEmail, readPrefillEmail, savePendingVerification } from "../lib/pending-verification";
import { destinationAfterLogin } from "../lib/redirect";
import { loginSchema } from "../schemas/auth-schemas";
import { setSession } from "../session/session-store";
import { AuthHeading } from "./auth-shell";

type Input_ = z.input<typeof loginSchema>;
type Output = z.output<typeof loginSchema>;

// After this many wrong passwords in a row we mention the lockout, so it is not a surprise.
const WARN_AFTER_FAILURES = 3;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const sessionExpired = params.get("reason") === "expired";

  const prefilled = useMemo(() => readPrefillEmail(), []);
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [attempt, setAttempt] = useState(0); // changes on every failure so the message plays its shake again
  const [failures, setFailures] = useState(0);
  const [startingVerification, setStartingVerification] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setFocus,
    formState: { errors },
  } = useForm<Input_, unknown, Output>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: prefilled, password: "" },
    mode: "onTouched",
  });

  // Land on the field that needs typing: the password when the email is already filled in.
  useEffect(() => {
    setFocus(prefilled ? "password" : "email");
  }, [prefilled, setFocus]);

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: (auth) => {
      clearPrefillEmail();
      setSession(auth);
      toast.success(`Welcome back, ${auth.user.firstName}`);
      router.replace(destinationAfterLogin(auth.user.role, next));
    },
    onError: (error) => {
      const found = describeLoginError(error);
      setProblem(found);
      setAttempt((count) => count + 1);
      if (found.kind === "bad-credentials") setFailures((count) => count + 1);
    },
  });

  // "Please verify your email": send a fresh code and go straight to the code screen.
  async function startVerification() {
    const email = getValues("email").trim().toLowerCase();
    setStartingVerification(true);
    try {
      await authApi.resendVerification(email);
    } catch {
      // The code screen offers "resend" if this did not go through.
    }
    savePendingVerification(email);
    router.push("/verify-email");
  }

  // Stay "busy" after success too, until the next page replaces this one: no second click, no flicker.
  const busy = login.isPending || login.isSuccess;

  return (
    <>
      <Reveal index={0}>
        <AuthHeading title="Welcome back" subtitle="Sign in to reserve your seat." />
      </Reveal>

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
                problem.action === "verify-email" ? (
                  <Button type="button" size="sm" variant="secondary" loading={startingVerification} onClick={startVerification}>
                    Verify my email
                  </Button>
                ) : undefined
              }
            >
              {problem.message}
            </Alert>
          )}
        </AnimatePresence>

        <Reveal index={1}>
          <Field label="Email" error={errors.email?.message}>
            {({ invalid, ...control }) => (
              <Input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" invalid={invalid} {...control} {...register("email")} />
            )}
          </Field>
        </Reveal>

        <Reveal index={2}>
          <Field label="Password" error={errors.password?.message}>
            {({ invalid, ...control }) => (
              <PasswordInput autoComplete="current-password" placeholder="Your password" invalid={invalid} {...control} {...register("password")} />
            )}
          </Field>
        </Reveal>

        <Reveal index={3} className="flex flex-col gap-3">
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {busy ? "Signing you in" : "Sign in"}
          </Button>
          {failures >= WARN_AFTER_FAILURES && (
            <p className="animate-fade-in text-center text-[0.8125rem] text-muted">
              Tip: after 5 wrong passwords, sign-in pauses for 15 minutes to keep your account safe.
            </p>
          )}
        </Reveal>
      </form>

      <Reveal index={4}>
        <p className="mt-8 text-center text-sm text-muted">
          New to Tapasya Times?{" "}
          <Link href="/register" className="group inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">
            Create an account
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </p>
      </Reveal>
    </>
  );
}
