# Integration tests

These tests talk to real services. They **skip automatically** when the
corresponding environment variables are absent, so `npm test` is safe to run
anywhere — including in CI without secrets.

| File | Needs |
| --- | --- |
| `rls.test.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, plus `TEST_USER_A_EMAIL` / `TEST_USER_A_PASSWORD` / `TEST_USER_B_EMAIL` / `TEST_USER_B_PASSWORD` |
| `auth.test.ts` | Same Supabase vars + the two test users |
| `searches.test.ts` | Supabase + a migrated database (`npm run db:migrate`) |
| `razorpay-webhook.test.ts` | `RAZORPAY_WEBHOOK_SECRET` (signs a synthetic payload locally; no network) |
| `migrations.test.ts` | Nothing — validates the SQL migration files on disk |

Run them against a real project with:

```bash
cp .env.example .env.local   # fill in Supabase + two test users
npm run db:migrate
npm test
```
