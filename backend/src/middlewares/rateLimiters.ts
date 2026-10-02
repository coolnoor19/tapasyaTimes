import { rateLimit } from "express-rate-limit"

const WINDOW_MS = 15 * 60 * 1000

// Broad safety net for the whole API.
export const generalLimiter = rateLimit({
    windowMs: WINDOW_MS,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
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
    message: { message: "Too many attempts, please try again later" },
})
