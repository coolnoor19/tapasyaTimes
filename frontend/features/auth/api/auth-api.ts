import { apiRequest } from "@/lib/api/client";
import type { AuthResponse, Profile, RegisteredUser } from "../types";

// Calls made BEFORE there is a session (or that only need the refresh cookie) pass `auth: false`:
// they must not send a token, and a 401 from them (wrong password) must not trigger a token refresh.

export const authApi = {
  register: (input: { firstName: string; lastName: string; email: string; phone: string; password: string }) =>
    apiRequest<RegisteredUser>("/auth/register", { method: "POST", body: input, auth: false }),

  verifyEmail: (input: { email: string; code: string }) =>
    apiRequest<{ message: string }>("/auth/verify-email", { method: "POST", body: input, auth: false }),

  resendVerification: (email: string) =>
    apiRequest<{ message: string }>("/auth/resend-verification", { method: "POST", body: { email }, auth: false }),

  login: (input: { email: string; password: string }) =>
    apiRequest<AuthResponse>("/auth/login", { method: "POST", body: input, auth: false }),

  // Uses the httpOnly refresh cookie; the backend rotates it on every call.
  refresh: () => apiRequest<AuthResponse>("/auth/refresh", { method: "POST", auth: false }),

  logout: () => apiRequest<{ message: string }>("/auth/logout", { method: "POST", auth: false }),

  me: () => apiRequest<Profile>("/auth/me"),
};
