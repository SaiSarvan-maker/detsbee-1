# Detsbee Architecture

## Overview

Monorepo-style layout:

```
apps/web   → React SPA (creator + recipient experiences)
apps/api   → Express REST API + Prisma data layer
```

Layers inside the API:

1. **Routes** — HTTP adapters, rate limits, auth gates  
2. **Services** — business rules (games, session, results, auth)  
3. **Lib** — tokens, env, prisma, errors  
4. **Prisma** — persistence  

## Key flows

### Creator

Register → Create game (select questions) → Receive invite token once → Share link → View shared-only results → Disable / rotate / delete

### Recipient

Open `/play/:token` → Privacy intro → Explicit consent → Round 1 About Me → Round 2 How I See You → Review → Submit → Private receipt

## Database (Prisma)

Entities: `User`, `QuestionCategory`, `Question`, `Game`, `GameQuestion`, `RespondentSession`, `ConsentRecord`, `Response`, `Activity`

### Token strategy

- Invite tokens: `db_…` random; store **SHA-256(pepper + token)**  
- Receipt tokens: `rcpt_…`; same hashing  
- Public URLs never expose database IDs for authorization

### Privacy query rule

Creator results query responses with `visibility = SHARE` only. Private / skipped / declined rows are never serialized into creator payloads.

## Frontend structure

- `/` landing  
- `/login`, `/register` creator auth  
- `/app/*` creator hive (dashboard, builder, results, profile)  
- `/play/:token` recipient game (dark, mobile-first)  
- `/receipt/:token` private receipt + deletion  

## Gamification

**Discovery Trail** progress bar + **Nectar** counter increment on any completed interaction (answer, skip, or decline). No bonus for choosing Share over Private.

## Creative features shipped

- Shared Ground overlap surfacing  
- Perspective Cards from short shared answers  
- The Little Things collection  
- Playful (non-clinical) insight blurb  
- Honeycomb visual language & dual-experience UI  
