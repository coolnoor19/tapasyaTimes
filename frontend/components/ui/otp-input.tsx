"use client";

import { useEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  // Called the moment the last digit is entered (by typing or pasting)
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  // Red boxes and a short shake
  invalid?: boolean;
  // Green boxes that light up one after another
  success?: boolean;
  autoFocus?: boolean;
  // Change this number to move focus back to the first box (after a wrong code was cleared)
  focusSignal?: number;
  label?: string;
}

const onlyDigits = (text: string) => text.replace(/\D/g, "");

// One box per digit, like a code on a phone. Types forward, deletes backward, accepts a pasted or
// auto-filled code (iOS and Android offer the SMS / email code above the keyboard).
// The value is always a plain string of digits with no gaps.
export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  invalid = false,
  success = false,
  autoFocus = false,
  focusSignal = 0,
  label = "Verification code",
}: OtpInputProps) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const focusBox = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(index, length - 1))];
    box?.focus();
    box?.select();
  };

  useEffect(() => {
    if (autoFocus || focusSignal > 0) focusBox(Math.min(value.length, length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, focusSignal]);

  // Once verified, drop the focus: otherwise the last digit stays highlighted as selected text.
  useEffect(() => {
    if (success) boxes.current.forEach((box) => box?.blur());
  }, [success]);

  const commit = (next: string, focusIndex: number) => {
    const trimmed = next.slice(0, length);
    onChange(trimmed);
    if (trimmed.length === length && trimmed !== value) onComplete?.(trimmed);
    focusBox(focusIndex);
  };

  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const digits = onlyDigits(event.target.value);

    if (digits === "") {
      // the box was emptied: remove that digit and close the gap
      commit(value.slice(0, index) + value.slice(index + 1), index);
      return;
    }
    // More than two digits at once is an auto-fill or a paste into one box: take it as the whole code.
    if (digits.length > 2) {
      commit(value.slice(0, index) + digits, index + digits.length);
      return;
    }
    // One typed digit (when two show up, the box already held one: the newest is the last).
    const typed = digits.slice(-1);
    commit(value.slice(0, index) + typed + value.slice(index + 1), index + 1);
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      // Backspace on an empty box deletes the digit before it
      event.preventDefault();
      commit(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = onlyDigits(event.clipboardData.getData("text"));
    if (digits) commit(digits, digits.length);
  };

  return (
    <div role="group" aria-label={label} className={cn("flex justify-between gap-2 sm:gap-2.5", invalid && "animate-shake")}>
      {Array.from({ length }, (_, index) => {
        const char = value[index] ?? "";
        return (
          <input
            key={index}
            ref={(node) => {
              boxes.current[index] = node;
            }}
            value={char}
            onChange={(event) => handleChange(index, event)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            onFocus={(event) => event.target.select()}
            disabled={disabled}
            inputMode="numeric"
            // Only the first box asks the phone to offer the code it just received
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${label}, digit ${index + 1} of ${length}`}
            aria-invalid={invalid || undefined}
            style={success ? { transitionDelay: `${index * 70}ms` } : undefined}
            className={cn(
              "h-14 w-full min-w-0 rounded-lg border bg-surface text-center font-display text-2xl font-semibold tabular text-ink caret-brand-600",
              "transition-[border-color,background-color,box-shadow,color,transform] duration-200",
              "focus-visible:border-brand-500 focus-visible:shadow-ring focus-visible:outline-none",
              "disabled:cursor-not-allowed",
              char && !invalid && !success && "animate-pop border-brand-400 bg-brand-50",
              !char && !invalid && !success && "border-line-strong",
              invalid && "border-danger-600 bg-danger-50 text-danger-700",
              success && "border-leaf-500 bg-leaf-50 text-leaf-800",
            )}
          />
        );
      })}
    </div>
  );
}
