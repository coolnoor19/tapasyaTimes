"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, MailCheck, RotateCw } from "lucide-react";
import type { z } from "zod";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/ui/otp-input";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import { authApi } from "../api/auth-api";
import { formatCountdown, useCooldown } from "../hooks/use-cooldown";
import { describeVerifyError } from "../lib/errors";
import {
  clearPendingVerification,
  getPendingServerSnapshot,
  getPendingSnapshot,
  maskEmail,
  parsePending,
  savePendingVerification,
  savePrefillEmail,
  subscribePending,
} from "../lib/pending-verification";
import { emailOnlySchema } from "../schemas/auth-schemas";
import { AuthHeading } from "./auth-shell";

const CODE_LENGTH = 6;
// The backend ignores a second request inside a minute without telling us, so we wait too and say so.
const RESEND_COOLDOWN_MS = 60_000;
// After this many wrong codes, remind them that the code dies after 5 and a new one is one click away.
const WARN_AFTER_WRONG = 3;

export function VerifyEmailForm() {
  // undefined = not known yet. Storage exists only in the browser, so the server (and the first paint) cannot know.
  const raw = useSyncExternalStore(subscribePending, getPendingSnapshot, getPendingServerSnapshot);
  const pending = useMemo(() => (raw === undefined ? undefined : parsePending(raw)), [raw]);

  if (pending === undefined) {
    return (
      <div className="flex flex-col gap-5" aria-hidden="true">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (pending === null) {
    return (
      <EmailStep
        onContinue={(email) => {
          // sentAt 0: no code was sent from here, so "resend" is available straight away
          savePendingVerification(email, 0);
        }}
      />
    );
  }

  return (
    <CodeStep
      key={pending.email}
      email={pending.email}
      sentAt={pending.sentAt}
      onSent={(sentAt) => savePendingVerification(pending.email, sentAt)}
      onChangeEmail={clearPendingVerification}
    />
  );
}

// ---------------------------------------------------------------------------
// Step 1 (only when we do not know the email): who is this code for?
// ---------------------------------------------------------------------------

function EmailStep({ onContinue }: { onContinue: (email: string) => void }) {
  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<z.input<typeof emailOnlySchema>, unknown, z.output<typeof emailOnlySchema>>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  useEffect(() => setFocus("email"), [setFocus]);

  return (
    <>
      <Reveal index={0}>
        <AuthHeading title="Verify your email" subtitle="Enter the email address you signed up with." />
      </Reveal>
      <form noValidate onSubmit={handleSubmit(({ email }) => onContinue(email))} className="flex flex-col gap-5">
        <Reveal index={1}>
          <Field label="Email" error={errors.email?.message}>
            {({ invalid, ...control }) => (
              <Input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" invalid={invalid} {...control} {...register("email")} />
            )}
          </Field>
        </Reveal>
        <Reveal index={2}>
          <Button type="submit" size="lg" className="w-full">
            Continue
          </Button>
        </Reveal>
      </form>
      <BackToSignIn />
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2: type the 6-digit code
// ---------------------------------------------------------------------------

interface CodeStepProps {
  email: string;
  sentAt: number;
  onSent: (sentAt: number) => void;
  onChangeEmail: () => void;
}

function CodeStep({ email, sentAt, onSent, onChangeEmail }: CodeStepProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [wrongCount, setWrongCount] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);
  const [verified, setVerified] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const remaining = useCooldown(sentAt, RESEND_COOLDOWN_MS);
  const codeWasSent = sentAt > 0;

  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const verify = useMutation({
    mutationFn: authApi.verifyEmail,
    onSuccess: () => {
      // Let the boxes turn green one by one before moving on
      setVerified(true);
      leaveTimer.current = setTimeout(() => {
        clearPendingVerification();
        savePrefillEmail(email);
        toast.success("Email verified", { description: "You can sign in now." });
        router.replace("/login");
      }, 1100);
    },
    onError: (error) => {
      const found = describeVerifyError(error);
      setMessage(found.message);
      if (found.kind === "wrong-code") {
        // Clear the boxes so the next try starts clean, and shake to say "not that one"
        setInvalid(true);
        setWrongCount((count) => count + 1);
        setCode("");
        setFocusSignal((signal) => signal + 1);
      }
      // For a network problem the digits stay, so a retry is one click.
    },
  });

  const resend = useMutation({
    mutationFn: () => authApi.resendVerification(email),
    onSuccess: () => {
      onSent(Date.now());
      setCode("");
      setMessage(null);
      setInvalid(false);
      setWrongCount(0);
      setFocusSignal((signal) => signal + 1);
      toast.success("New code on its way", { description: "Check your inbox. The old code no longer works." });
    },
    onError: () => toast.error("Could not send a new code", { description: "Please check your connection and try again." }),
  });

  const submit = (value: string) => {
    if (value.length === CODE_LENGTH && !verify.isPending && !verified) verify.mutate({ email, code: value });
  };

  const canResend = remaining === 0 && !resend.isPending && !verified;

  return (
    <>
      <Reveal index={0}>
        <AuthHeading
          title="Check your email"
          subtitle={
            codeWasSent ? (
              <>
                We sent a 6-digit code to <strong className="font-semibold text-ink">{maskEmail(email)}</strong>. It stays valid for 10 minutes.
              </>
            ) : (
              <>
                Enter the 6-digit code we emailed to <strong className="font-semibold text-ink">{maskEmail(email)}</strong>, or ask for a new one below.
              </>
            )
          }
        />
      </Reveal>

      <div className="flex flex-col gap-5">
        <AnimatePresence initial={false}>
          {message && (
            <Alert key={`msg-${wrongCount}-${message}`} tone="danger" shake>
              {message}
            </Alert>
          )}
          {wrongCount >= WARN_AFTER_WRONG && !verified && (
            <Alert key="warn" tone="warn">
              A code stops working after 5 wrong tries. If you are unsure, ask for a new one below.
            </Alert>
          )}
          {verified && (
            <Alert key="ok" tone="success" title="Email verified">
              Taking you to sign in…
            </Alert>
          )}
        </AnimatePresence>

        <Reveal index={1}>
          <OtpInput
            value={code}
            onChange={(next) => {
              setCode(next);
              if (invalid) setInvalid(false);
              if (message) setMessage(null);
            }}
            onComplete={submit}
            length={CODE_LENGTH}
            disabled={verify.isPending || verified}
            invalid={invalid}
            success={verified}
            autoFocus
            focusSignal={focusSignal}
          />
        </Reveal>

        <Reveal index={2} className="flex flex-col gap-4">
          <Button
            type="button"
            size="lg"
            variant={verified ? "accent" : "primary"}
            loading={verify.isPending}
            disabled={code.length !== CODE_LENGTH || verified}
            onClick={() => submit(code)}
            className="w-full"
          >
            {verified ? (
              <>
                <MailCheck className="size-5 animate-pop" /> Verified
              </>
            ) : (
              "Verify email"
            )}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <button
              type="button"
              onClick={() => resend.mutate()}
              disabled={!canResend}
              className="group inline-flex items-center gap-1.5 font-semibold text-brand-700 transition-colors enabled:hover:text-brand-800 disabled:cursor-not-allowed disabled:text-subtle"
            >
              <RotateCw className={`size-3.5 ${resend.isPending ? "animate-spin" : "transition-transform duration-300 group-enabled:group-hover:rotate-180"}`} />
              {resend.isPending ? "Sending" : remaining > 0 ? `Resend code in ${formatCountdown(remaining)}` : "Resend code"}
            </button>
            <button type="button" onClick={onChangeEmail} disabled={verified} className="text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50">
              Use a different email
            </button>
          </div>
        </Reveal>
      </div>

      <BackToSignIn />
    </>
  );
}

function BackToSignIn() {
  return (
    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8 text-center text-sm text-muted">
      <Link href="/login" className="group inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800">
        <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
        Back to sign in
      </Link>
    </motion.p>
  );
}
