import "dotenv/config"
import { z } from "zod"

const envSchema = z.object({
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
