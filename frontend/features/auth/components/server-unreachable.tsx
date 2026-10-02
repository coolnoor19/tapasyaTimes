"use client";

import { useState } from "react";
import { RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// The server could not be reached while checking the session. We do NOT send the person to the sign-in page
// (they may well be signed in): we say what is wrong and let them try again.
export function ServerUnreachable({ onRetry }: { onRetry: () => void }) {
  const [trying, setTrying] = useState(false);

  return (
    <div role="alert" className="grid min-h-dvh place-items-center bg-canvas px-6">
      <div className="flex max-w-sm animate-fade-up flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-warn-50 text-warn-600">
          <WifiOff className="size-7" />
        </span>
        <h1 className="text-2xl font-bold text-ink">We can’t reach the server</h1>
        <p className="text-[0.9375rem] text-muted">Check your internet connection. You haven’t been signed out.</p>
        <Button
          loading={trying}
          onClick={() => {
            setTrying(true);
            onRetry();
          }}
        >
          <RotateCw className="size-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
