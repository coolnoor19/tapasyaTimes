# Tests

```bash
npm test             # everything (database tests need TEST_DATABASE_URL)
npm run test:unit    # fast tests, no database needed
npm run test:watch   # re-run on file change
npm run typecheck    # type-check src and tests
```

## Layout

- `unit/` pure logic: validators, OTP hashing, error helpers, email templates, env validation
- `integration/` real HTTP (supertest) + real Postgres: constraints, register, email verification, security headers, rate limiting
- `helpers/` test database reset, data factories, and the fake mailbox that captures emails instead of sending them

## Test database

Integration tests TRUNCATE every table. Set `TEST_DATABASE_URL` in `backend/.env` to a
**separate** database (a second Neon branch works). The run aborts if it equals `DATABASE_URL`.
Without it, database tests are skipped (not failed). The schema is migrated automatically
before the run.

## Rules

- Every new feature ships with tests, and every bug fix with a test that fails without the fix.
- Emails are never really sent in tests; assert on `tests/helpers/mailbox.ts`.
- Rate limiting is off in tests; `integration/security.test.ts` switches it on for its own cases.
