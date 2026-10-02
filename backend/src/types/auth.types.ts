import { z } from "zod"
import {
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    resendVerificationSchema,
} from "../validators/auth.validator.js"

export type RegisterUserDto = z.infer<typeof registerSchema>
export type LoginUserDto = z.infer<typeof loginSchema>
export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>
export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>
