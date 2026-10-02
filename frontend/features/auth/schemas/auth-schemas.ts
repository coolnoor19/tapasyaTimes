import { z } from "zod";

// These mirror the backend's rules (backend/src/validators/auth.validator.ts) so most mistakes are caught
// on the page, before a request is made. The backend still re-checks everything.

const email = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"))
  .pipe(z.string().max(255, "That email address is too long"));

// People type phone numbers with spaces and dashes; the backend wants digits with an optional leading +.
export const normalizePhone = (value: string) => value.replace(/[\s\-().]/g, "");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(100, "That name is too long"),
  lastName: z.string().trim().min(1, "Enter your last name").max(100, "That name is too long"),
  email,
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().min(1, "Enter your mobile number").regex(/^\+?[0-9]{10,15}$/, "Enter a valid mobile number, for example 9876543210")),
  password: z.string().min(8, "Use at least 8 characters").max(72, "Use 72 characters or fewer"),
});

export const emailOnlySchema = z.object({ email });

export type LoginValues = z.input<typeof loginSchema>;
export type RegisterValues = z.input<typeof registerSchema>;
