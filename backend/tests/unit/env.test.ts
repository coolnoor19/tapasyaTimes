import { spawnSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const backendDir = resolve(import.meta.dirname, "../..")

// env.ts calls process.exit(1) on bad config, so each case runs it in a child process.
function loadEnv(overrides: Record<string, string>) {
    const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", "import './src/config/env.ts'"],
        {
            cwd: backendDir,
            encoding: "utf8",
            env: {
                ...process.env,
                // Explicit values (even empty) beat anything in the developer's .env
                NODE_ENV: "development",
                DATABASE_URL: "postgresql://u:p@127.0.0.1:5432/db",
                OTP_HMAC_SECRET: "x".repeat(40),
                JWT_ACCESS_SECRET: "y".repeat(40),
                SMTP_HOST: "",
                SMTP_USER: "",
                SMTP_PASS: "",
                MAIL_FROM: "",
                ...overrides,
            },
        },
    )
    return { status: result.status, stderr: result.stderr }
}

describe("environment validation", () => {
    it("starts with a valid configuration and SMTP unset (development)", () => {
        expect(loadEnv({}).status).toBe(0)
    })

    it("fails fast on an invalid DATABASE_URL and does not print its value", () => {
        const { status, stderr } = loadEnv({ DATABASE_URL: "super-secret-not-a-url" })
        expect(status).toBe(1)
        expect(stderr).toContain("DATABASE_URL")
        expect(stderr).not.toContain("super-secret-not-a-url")
    })

    it("fails when OTP_HMAC_SECRET is too short, without printing it", () => {
        const { status, stderr } = loadEnv({ OTP_HMAC_SECRET: "short-secret" })
        expect(status).toBe(1)
        expect(stderr).toContain("OTP_HMAC_SECRET")
        expect(stderr).not.toContain("short-secret")
    })

    it("requires SMTP settings in production", () => {
        const { status, stderr } = loadEnv({ NODE_ENV: "production" })
        expect(status).toBe(1)
        expect(stderr).toContain("SMTP_HOST")
    })

    it("requires SMTP_PASS when SMTP_USER is set", () => {
        const { status, stderr } = loadEnv({ SMTP_HOST: "smtp.example.com", SMTP_USER: "me@example.com" })
        expect(status).toBe(1)
        expect(stderr).toContain("SMTP_PASS")
    })

    it("accepts full SMTP settings in production", () => {
        const { status } = loadEnv({
            NODE_ENV: "production",
            SMTP_HOST: "smtp.example.com",
            SMTP_USER: "me@example.com",
            SMTP_PASS: "abcd efgh ijkl mnop",
        })
        expect(status).toBe(0)
    })
})
