import express from "express"
import { validate } from "../middlewares/validate.js"
import {
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    resendVerificationSchema,
} from "../validators/auth.validator.js"
import {
    registerUserHandler,
    resendVerificationHandler,
    verifyEmailHandler,
} from "../controllers/auth.controller.js"
import { authLimiter } from "../middlewares/rateLimiters.js"

export const router = express.Router()

router.use(authLimiter)

router.post('/register', validate(registerSchema), registerUserHandler)

router.post('/verify-email', validate(verifyEmailSchema), verifyEmailHandler)

router.post('/resend-verification', validate(resendVerificationSchema), resendVerificationHandler)

router.post('/login', validate(loginSchema), (req, res) => {
    res.status(501).json({ message: "Not implemented" })
})
