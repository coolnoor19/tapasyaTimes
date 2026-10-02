import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "@/lib/api/client";

// Retrying only helps for temporary problems. A 400 / 401 / 403 / 404 / 409 will answer the same again.
const shouldRetry = (failureCount: number, error: unknown) => {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
