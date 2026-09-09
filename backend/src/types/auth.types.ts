import { z } from "zod"
import { registerSchema, loginSchema } from "../validators/auth.validator.js"

export type RegisterUserDto = z.infer<typeof registerSchema>
export type LoginUserDto = z.infer<typeof loginSchema>
