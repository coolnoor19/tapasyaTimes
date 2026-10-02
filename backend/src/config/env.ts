import "dotenv/config"
import { z } from "zod"

// An empty value in .env (e.g. `SMTP_HOST=`) counts as "not set".
const optionalString = z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)

const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
        PORT: z.coerce.number().int().positive().default(3005),
        DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
        // Comma-separated list of frontend origins allowed to call the API
        CORS_ORIGINS: z
            .string()
            .default("http://localhost:3000")
            .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean)),
        // Number of reverse proxies in front of the app (0 = none). Needed so rate
        // limiting sees the real client IP instead of the proxy's IP.
        TRUST_PROXY: z.coerce.number().int().min(0).default(0),

        // Secret used to hash one-time codes, so a leaked database alone cannot
        // reveal them. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
        OTP_HMAC_SECRET: z.string().min(32, "must be at least 32 characters"),

        // Email (SMTP). Optional in development: without SMTP_HOST, emails are
        // printed to the terminal instead of being sent.
        SMTP_HOST: optionalString,
        SMTP_PORT: z.coerce.number().int().positive().default(587),
        SMTP_USER: optionalString,
        // Gmail shows app passwords in groups separated by spaces; strip them.
        SMTP_PASS: optionalString.transform((value) => value?.replace(/\s+/g, "")),
        // Defaults to "Tapasya Times <SMTP_USER>". Gmail only sends from your own address.
        MAIL_FROM: optionalString,
    })
    .superRefine((value, ctx) => {
        if (value.SMTP_USER && !value.SMTP_PASS) {
            ctx.addIssue({ code: "custom", path: ["SMTP_PASS"], message: "required when SMTP_USER is set" })
        }
        if (value.NODE_ENV === "production") {
            for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
                if (!value[key]) {
                    ctx.addIssue({ code: "custom", path: [key], message: "required in production" })
                }
            }
        }
    })

const result = envSchema.safeParse(process.env)

if (!result.success) {
    // Print variable names and problems only, never the values (they may be secrets).
    console.error("Invalid environment configuration:")
    for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`)
    }
    process.exit(1)
}

export const env = result.data
