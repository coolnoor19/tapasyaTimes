import { rateLimit } from "express-rate-limit"
import { env } from "../config/env.js"

const WINDOW_MS = 15 * 60 * 1000

// The test suite makes many requests from one address; the rate-limit test
// switches NODE_ENV back temporarily to exercise the real limiter.
const skipInTests = () => env.NODE_ENV === "test"

// Broad safety net for the whole API.
export const generalLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: skipInTests,
    message: { message: "Too many requests, please try again later" },
})

// Stricter limit for register/login to slow down password guessing.
// Kept moderate because many users share one IP on the workspace Wi-Fi;
// per-account lockout is added together with login.
export const authLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: skipInTests,
    message: { message: "Too many attempts, please try again later" },
})
