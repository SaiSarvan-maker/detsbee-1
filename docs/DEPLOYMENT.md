# Deployment

## Vercel deployment

The root `vercel.json` deploys the Vite app as static output and routes `/api/*` to the Express function in `api/index.ts`. The build generates Prisma Client and builds both the API and web app.

Before deploying, change the datasource provider in `apps/api/prisma/schema.prisma` from `sqlite` to `postgresql` as shown below, then provision PostgreSQL and set `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and `TOKEN_PEPPER` (at least 32 characters) in Vercel Project Settings. Set `NODE_ENV=production`, `DEMO_MODE=false`, `COOKIE_SECURE=true`, and `CLIENT_ORIGIN` to the production web origin. Apply the Prisma schema to the hosted database with `npx prisma db push --schema=apps/api/prisma/schema.prisma` as a one-time setup, then seed only if desired using the controlled seed procedure below. Production startup now rejects SQLite and no longer falls back to development secrets.

Password recovery sends a one-time, 30-minute link through Gmail SMTP. Enable 2-Step Verification on a dedicated Gmail sender account, create an App Password, then add `GMAIL_USER` and `GMAIL_APP_PASSWORD` to the Vercel Production environment. Do not use your normal Gmail password. After schema changes, run `npx prisma db push --schema=apps/api/prisma/schema.prisma` against the hosted database before deploying the code that uses the new columns.

Do not use SQLite on Vercel: function filesystems are ephemeral and cannot provide durable shared state across invocations.

## Recommended production shape

1. **Database:** PostgreSQL  
2. **API:** Node host (Railway, Fly.io, Render, VPS)  
3. **Web:** Static Vite build on Netlify, Cloudflare Pages, or Vercel  
4. **TLS:** HTTPS everywhere; `COOKIE_SECURE=true`

## Switch Prisma to PostgreSQL

1. In `apps/api/prisma/schema.prisma`, set:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Set `DATABASE_URL` to your Postgres connection string.  
3. Run `npx prisma migrate dev --name init` (or `db push` for prototypes).  
4. Seed with `npx tsx prisma/seed.ts` only in non-production or controlled demos.

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
