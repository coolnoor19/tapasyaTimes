import { isApiError } from "@/lib/api/client";

// Turns what went wrong into something a person can act on. Kept in one place so every form speaks the same way
// (and so it can be tested without rendering anything).

export interface FormProblem {
  tone: "danger" | "warn";
  message: string;
  // a button the form can offer next to the message
  action?: "verify-email" | "sign-in";
  // which field the problem belongs to, when it is about one
  field?: "email" | "phone";
  // lets a form react to specific cases without reading the message text
  kind?: "bad-credentials";
}

const NETWORK = "We could not reach the server. Check your connection and try again.";
const GENERIC = "Something went wrong on our side. Please try again in a moment.";
const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";

export function describeLoginError(error: unknown): FormProblem {
  if (!isApiError(error)) return { tone: "danger", message: GENERIC };
  if (error.isNetworkError) return { tone: "danger", message: NETWORK };
  if (error.status === 429) return { tone: "warn", message: RATE_LIMITED };
  if (error.status === 403 && error.code === "EMAIL_NOT_VERIFIED") {
    return { tone: "warn", message: "Please verify your email before signing in.", action: "verify-email" };
  }
  if (error.status === 403 && error.code === "ACCOUNT_SUSPENDED") {
    return { tone: "danger", message: "This account is suspended. Please contact the Tapasya Times team." };
  }
  // The backend answers a wrong password, an unknown email and a locked account the same way, on purpose.
  if (error.status === 401) return { tone: "danger", kind: "bad-credentials", message: "That email and password don’t match. Please try again." };
  return { tone: "danger", message: GENERIC };
}

export function describeRegisterError(error: unknown): FormProblem {
  if (!isApiError(error)) return { tone: "danger", message: GENERIC };
  if (error.isNetworkError) return { tone: "danger", message: NETWORK };
  if (error.status === 429) return { tone: "warn", message: RATE_LIMITED };
  if (error.status === 409) {
    // "Email is already registered" / "Phone number is already registered"
    const phone = /phone/i.test(error.message);
    return {
      tone: "warn",
      field: phone ? "phone" : "email",
      message: phone ? "An account with this mobile number already exists." : "An account with this email already exists.",
      action: "sign-in",
    };
  }
  if (error.status === 400) return { tone: "danger", message: "Some details look incorrect. Please check them and try again." };
  return { tone: "danger", message: GENERIC };
}

export function describeVerifyError(error: unknown): { kind: "wrong-code" | "other"; message: string } {
  if (isApiError(error) && error.status === 400) {
    return { kind: "wrong-code", message: "That code didn’t work. Check the newest email, or ask for a new code." };
  }
  if (isApiError(error) && error.isNetworkError) return { kind: "other", message: NETWORK };
  if (isApiError(error) && error.status === 429) return { kind: "other", message: RATE_LIMITED };
  return { kind: "other", message: GENERIC };
}
