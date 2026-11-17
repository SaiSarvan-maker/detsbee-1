# Deployment

## Vercel deployment

The root `vercel.json` deploys the Vite app as static output, routes `/api/*` to the Express function in `api/index.ts`, and runs the daily retention-cleanup cron. The build generates Prisma Client and builds both the API and web app.

The checked-in Prisma datasource already uses PostgreSQL. Provision PostgreSQL and set `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and `TOKEN_PEPPER` (at least 32 characters) in Vercel Project Settings. Also set `NODE_ENV=production`, `DEMO_MODE=false`, `COOKIE_SECURE=true`, `CLIENT_ORIGIN` to the public HTTPS web origin, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `CRON_SECRET` (at least 32 random characters). Production startup validates these requirements and rejects SQLite.

Set `VITE_APP_URL=https://detsbee-1.vercel.app` in the Vercel Production environment. This public base URL is used to build invitation links in the web app, Android WebView, and API responses. Set the same variable when building the Android app; if omitted, the frontend falls back to the production URL.

Registration requires email verification through Gmail SMTP. Password recovery sends a one-time, 30-minute link through the same sender. Enable 2-Step Verification on a dedicated Gmail sender account, create an App Password, then add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to Vercel. Do not use your normal Gmail password. The daily retention job removes respondent sessions, answers, and consent records after each session's existing `retentionDays` deadline; Vercel must have `CRON_SECRET` configured for it to run.

For this schema update, the reviewed diff is additive: it adds `User.authVersion` (integer, default `0`) and nullable `User.verifyTokenExpiresAt`. Before applying it to the hosted database, take and verify a backup, then review the generated SQL. Only after those steps should you run `npx prisma db push --schema=apps/api/prisma/schema.prisma`. The repository does not yet contain a Prisma migrations history; use a reviewed migration workflow for future production schema changes rather than relying on repeated `db push` operations.

Do not use SQLite on Vercel: function filesystems are ephemeral and cannot provide durable shared state across invocations.

## Recommended production shape

1. **Database:** PostgreSQL  
2. **API:** Vercel Node function at `api/index.ts` (or a separate Node host if moved)
3. **Web:** Vite static build served by Vercel from `apps/web/dist`
4. **TLS:** HTTPS everywhere; `COOKIE_SECURE=true`

## Switch Prisma to PostgreSQL

1. The datasource in `apps/api/prisma/schema.prisma` is already:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. For the initial hosted schema only, apply it with `npx prisma db push --schema=apps/api/prisma/schema.prisma`.
4. Do not seed production by default. Seed only after reviewing `apps/api/prisma/seed.ts` and confirming its records are appropriate for the live database.

## API integration tests

The API integration tests can use a disposable local PostgreSQL database when Prisma's SQLite schema engine is unavailable. Start PostgreSQL bound to `127.0.0.1` on port `55432`, create an empty database named `detsbee_test_<suffix>`, then run in PowerShell:

```powershell
$env:TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:55432/detsbee_test_local?schema=public"
npm test --workspace=@detsbee/api
Remove-Item Env:TEST_DATABASE_URL
```

The runner rejects non-local hosts, other ports, and database names without the `detsbee_test_` prefix. Each run force-resets that test database before applying the checked-in Prisma schema. Never set `TEST_DATABASE_URL` to production or another database containing data you need.

## Build

```bash
cd apps/api && npm run build && npm start
cd apps/web && npm run build
```

Serve `apps/web/dist` behind your CDN. Point `VITE_API_URL` at the public API origin if not reverse-proxied under `/api`.

## Reverse proxy example

Terminate TLS at the edge; proxy `/api` → API service and `/` → static web.

## Secrets checklist

- [ ] Strong `JWT_SECRET`  
- [ ] Strong `TOKEN_PEPPER`  
- [ ] `DEMO_MODE=false`  
- [ ] Rotate demo invite tokens out of production seeds  
- [ ] Restrict CORS `CLIENT_ORIGIN`  
