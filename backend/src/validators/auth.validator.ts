import { z } from "zod"

export const registerSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    email: z.string().trim().toLowerCase().email("Invalid email address").max(255),
    phone: z.string().trim().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number"),
    password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
})

export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
})
