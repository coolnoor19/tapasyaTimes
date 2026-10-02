import express from "express"
import { validate } from "../middlewares/validate.js"
import {
    registerSchema,
    loginSchema,
    verifyEmailSchema,
    resendVerificationSchema,
} from "../validators/auth.validator.js"
import {
    loginHandler,
    logoutAllHandler,
    logoutHandler,
    meHandler,
    refreshHandler,
    registerUserHandler,
    resendVerificationHandler,
    verifyEmailHandler,
} from "../controllers/auth.controller.js"
import { authLimiter } from "../middlewares/rateLimiters.js"
import { authenticate } from "../middlewares/authenticate.js"
import { requireTrustedOrigin } from "../middlewares/requireTrustedOrigin.js"

export const router = express.Router()

// Strict per-IP limit only where passwords or codes can be guessed. Refresh, /me and
// logout run on every page load, so they use the general limit instead.
router.post('/register', authLimiter, validate(registerSchema), registerUserHandler)
router.post('/verify-email', authLimiter, validate(verifyEmailSchema), verifyEmailHandler)
router.post('/resend-verification', authLimiter, validate(resendVerificationSchema), resendVerificationHandler)
router.post('/login', authLimiter, validate(loginSchema), loginHandler)

// These act on the httpOnly refresh cookie, so they also check the request origin.
router.post('/refresh', requireTrustedOrigin, refreshHandler)
router.post('/logout', requireTrustedOrigin, logoutHandler)

router.post('/logout-all', authenticate, logoutAllHandler)
router.get('/me', authenticate, meHandler)
