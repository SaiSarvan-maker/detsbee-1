# Detsbee

Consent-driven social discovery. People share little preferences voluntarily, then answer how they see the person who invited them — with per-answer visibility, private receipts, and backend-enforced privacy.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS v4, Framer Motion
- **API:** Node.js, Express, TypeScript, Zod
- **Data:** Prisma + SQLite (local/demo) — PostgreSQL-ready schema notes in `docs/architecture.md`
- **Auth:** bcrypt password hashing + JWT (httpOnly cookie + Bearer)

## Quick start

```bash
# From repo root
cd apps/api
npm install
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev

# New terminal
cd apps/web
npm install
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001  

### Demo credentials

| Role | Access |
|------|--------|
| Creator | `demo@detsbee.app` / `honeycomb123` |
| Invite | `/play/db_DEMOINVITETOKEN1234567890ABCD` |

## Scripts

| Command | Where | Purpose |
|---------|-------|---------|
| `npm run dev` | `apps/api` | API watch mode |
| `npm run dev` | `apps/web` | Vite frontend |
| `npm test` | `apps/api` | Privacy & flow tests |
| `npm run build` | each app | Production build |

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` and set secrets before production.

## Documentation

- `docs/architecture.md` — system design & schema
- `docs/security.md` — privacy & security model
- `docs/delivery-report.md` — final delivery report
- `docs/DEPLOYMENT.md` — deploy notes

## Product principles

1. No collection before consent  
2. Skip / decline / private are first-class  
3. Private answers are excluded from creator APIs, not merely hidden in UI  
4. Invitation & receipt tokens are stored hashed  
5. Gamification rewards participation, never disclosure  
