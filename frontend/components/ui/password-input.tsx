"use client";

import { useState, type ComponentProps, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input } from "./input";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

// A password field with a show / hide button, and a warning when Caps Lock is on (the most common reason
// a correct password is "wrong").
export function PasswordInput({ className, onKeyUp, onKeyDown, onBlur, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    // Only meaningful while typing; some keys (Tab, arrows) report nothing useful
    if (event.getModifierState) setCapsLock(event.getModifierState("CapsLock"));
  };

  return (
    <div>
      <div className="relative">
        <Input
          {...props}
          type={visible ? "text" : "password"}
          className={cn("pr-12", className)}
          onKeyDown={(event) => {
            trackCapsLock(event);
            onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            trackCapsLock(event);
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-subtle transition-colors hover:bg-brand-50 hover:text-brand-700 active:scale-90"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={visible ? "hide" : "show"}
              initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
              transition={{ duration: 0.14 }}
              className="grid place-items-center"
            >
              {visible ? <EyeOff className="size-[1.125rem]" /> : <Eye className="size-[1.125rem]" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <AnimatePresence initial={false}>
        {capsLock && (
          <motion.p
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.16 }}
            className="mt-1.5 flex items-center gap-1.5 overflow-hidden text-[0.8125rem] font-medium text-warn-600"
          >
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            Caps Lock is on
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
