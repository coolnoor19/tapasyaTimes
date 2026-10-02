import { z } from "zod"

const email = z.string().trim().toLowerCase().email("Invalid email address").max(255)

export const registerSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email,
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
})

export const loginSchema = z.object({
    email,
    password: z.string().min(1, "Password is required"),
})

export const verifyEmailSchema = z.object({
    email,
    code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
})

export const resendVerificationSchema = z.object({
    email,
})
