"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { describeRegisterError, type FormProblem } from "../lib/errors";
import { savePendingVerification } from "../lib/pending-verification";
import { registerSchema } from "../schemas/auth-schemas";
import { AuthHeading } from "./auth-shell";
import { PasswordStrengthMeter } from "./password-strength-meter";

type RegisterInput = z.input<typeof registerSchema>;
type RegisterOutput = z.output<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [problem, setProblem] = useState<FormProblem | null>(null);
  const [attempt, setAttempt] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<RegisterInput, unknown, RegisterOutput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", password: "" },
    mode: "onTouched",
  });

  const password = watch("password");

  const signUp = useMutation({
    mutationFn: authApi.register,
    onSuccess: (user) => {
      // The backend has emailed a code. Remember who it was for, so the next screen knows.
      savePendingVerification(user.email);
      toast.success("Account created", { description: "We emailed you a 6-digit code to confirm your address." });
      router.push("/verify-email");
    },
    onError: (error) => {
      const found = describeRegisterError(error);
      setProblem(found);
      setAttempt((count) => count + 1);
      // Mark the field that clashes, so it is clear what to change
      if (found.field) setError(found.field, { message: "Already registered" }, { shouldFocus: true });
    },
  });

  const busy = signUp.isPending || signUp.isSuccess;

  return (
    <>
      <Reveal index={0}>
        <AuthHeading title="Create your account" subtitle="It takes a minute. We’ll email you a code to confirm your address." />
      </Reveal>

      <form
        noValidate
        onSubmit={handleSubmit((values) => {
          setProblem(null);
          signUp.mutate(values);
        })}
        className="flex flex-col gap-5"
      >
        <AnimatePresence initial={false}>
          {problem && (
            <Alert
              key={`problem-${attempt}`}
              tone={problem.tone}
              shake
              action={
                problem.action === "sign-in" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/login">Sign in instead</Link>
                  </Button>
                ) : undefined
              }
            >
              {problem.message}
            </Alert>
          )}
        </AnimatePresence>

        <Reveal index={1} className="grid gap-5 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message}>
            {({ invalid, ...control }) => <Input autoComplete="given-name" invalid={invalid} {...control} {...register("firstName")} />}
          </Field>
          <Field label="Last name" error={errors.lastName?.message}>
            {({ invalid, ...control }) => <Input autoComplete="family-name" invalid={invalid} {...control} {...register("lastName")} />}
          </Field>
        </Reveal>

        <Reveal index={2}>
          <Field label="Email" error={errors.email?.message}>
            {({ invalid, ...control }) => (
              <Input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" invalid={invalid} {...control} {...register("email")} />
            )}
          </Field>
        </Reveal>

        <Reveal index={3}>
          <Field label="Mobile number" hint="For example 9876543210" error={errors.phone?.message}>
            {({ invalid, ...control }) => (
              <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="98765 43210" invalid={invalid} {...control} {...register("phone")} />
            )}
          </Field>
        </Reveal>

        <Reveal index={4}>
          <Field label="Password" error={errors.password?.message}>
            {({ invalid, ...control }) => (
              <>
                <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" invalid={invalid} {...control} {...register("password")} />
                <PasswordStrengthMeter password={password ?? ""} />
              </>
            )}
          </Field>
        </Reveal>

        <Reveal index={5}>
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {busy ? "Creating your account" : "Create account"}
          </Button>
        </Reveal>
      </form>

      <Reveal index={6}>
        <p className="mt-8 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="group inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">
            Sign in
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </p>
      </Reveal>
    </>
  );
}
