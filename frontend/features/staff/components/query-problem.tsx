"use client";

import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isApiError } from "@/lib/api/client";

// One way to say "the data did not load" on every staff screen, in words that tell staff what to do.
//  - 403: the role changed while the page was open (an admin demoted this account, or suspended it). The backend checks
//    the role on every request, so the data is already refused; this just explains why instead of a blank page.
//  - no connection / server trouble: a retry button.
export function QueryProblem({ error, onRetry, retrying, what, action }: { error: unknown; onRetry?: () => void; retrying?: boolean; what: string; action?: ReactNode }) {
  if (isApiError(error) && error.status === 403) {
    return (
      <Alert tone="danger" title="Your account can’t see this any more">
        Your access may have been changed while this page was open. Sign out and back in; if it keeps happening, ask an admin.
      </Alert>
    );
  }

  const offline = isApiError(error) && error.isNetworkError;
  return (
    <Alert
      tone="danger"
      title={`We couldn’t load ${what}`}
      action={
        action ??
        (onRetry && (
          <Button size="sm" variant="secondary" loading={retrying ?? false} onClick={onRetry}>
            Try again
          </Button>
        ))
      }
    >
      {offline ? "Check your connection and try again." : "Please try again in a moment."}
    </Alert>
  );
}

// "Not found" for a booking or customer opened from a link: a wrong id, or an id that is not a customer.
export const isNotFound = (error: unknown) => isApiError(error) && (error.status === 404 || error.status === 400);
