import { resolveTestDatabaseUrl } from "./helpers/testEnv.js"

// Runs before every test file, BEFORE any app code is imported, so the app's
// env validation sees test values. Real variables win over .env (dotenv never
// overrides), so these assignments are what the app uses.
const testUrl = resolveTestDatabaseUrl()

process.env.NODE_ENV = "test"
// Never the dev database: without a test DB this unreachable URL is used and
// integration tests are skipped.
process.env.DATABASE_URL = testUrl ?? "postgresql://test:test@127.0.0.1:1/test"
process.env.HAS_TEST_DB = testUrl ? "1" : ""
process.env.OTP_HMAC_SECRET = "test-only-otp-secret-0123456789abcdef"
process.env.CORS_ORIGINS = "http://localhost:3000"
process.env.TRUST_PROXY = "0"
// Empty = "not set": emails are captured by the test mailbox, never sent.
process.env.SMTP_HOST = ""
process.env.SMTP_USER = ""
process.env.SMTP_PASS = ""
process.env.MAIL_FROM = ""
