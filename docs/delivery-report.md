# Detsbee Delivery Report

## 1. Interpretation

Detsbee is a **consent-first, two-sided discovery ritual**: one person invites another to share little preferences (About Me) and then to reflect how they see the inviter (How I See You). It should feel like a warm social game, not a survey SaaS dashboard — while enforcing privacy on the server.

## 2. Original creative additions

- **Discovery Trail + Nectar** — progress and participation rewards that never incentivize disclosure over privacy  
- **Shared Ground** — overlap / interest surfacing from shared About Me answers  
- **Perspective Cards** — cinematic cards built from short shared reflections  
- **The Little Things** — curated preference collection in results  
- **Dual visual systems** — cream/honey creator hive vs dark mobile-first play experience  
- **Honeycomb brand mark** — hex motif without cartoon excess  

## 3. Final feature list

| Feature | Status |
|---------|--------|
| Brand identity + design system | Complete |
| Landing page | Complete |
| Creator register / login / profile | Complete |
| Creator dashboard | Complete |
| Game builder + catalog | Complete |
| Secure invite tokens (hashed) | Complete |
| Link disable / rotate / expire | Complete |
| Recipient intro + consent gate | Complete |
| Round 1 & Round 2 play | Complete |
| Share / Private / Skip / Decline | Complete |
| Review + submit | Complete |
| Creator results (shared-only) | Complete |
| Respondent receipt + deletion | Complete |
| Creator game deletion | Complete |
| Demo seed data | Complete |
| Automated privacy/API tests | Complete (18/18) |
| Email verification provider | Simulated locally (`emailVerified` auto-true in non-production) |
| Production email sending | Pending external provider |
| PostgreSQL in local demo | Pending (SQLite local; Postgres path documented) |
| Optional AI summaries | Not shipped (intentionally deferred) |

## 4. Design decisions

- Signature honey yellow on premium ink surfaces; cream canvases for creator tools  
- Typography: Fraunces (display) + Manrope (UI)  
- Recipient flow is a separate dark, single-column app  
- Cards only where they aid interaction (results, play steps)  
- Motion used for phase transitions and trail progress, not decoration spam  

## 5. Architecture

React/Vite SPA ↔ Express REST API ↔ Prisma (SQLite local / Postgres production)  
Services isolate auth, games, sessions, and results. See `docs/architecture.md`.

## 6. Database schema

Normalized models for users, catalog questions, games, game-questions, respondent sessions, consent records, responses (with visibility enum), and activity feed. Tokens stored as hashes + hints.

## 7. Implemented functionality

End-to-end creator and recipient loops work with seeded demo account and invite token.

## 8. Security & privacy decisions

Backend filters creator results to `SHARE` only; receipt token required for play mutations; rate limits; helmet; hashed tokens; deletion workflows. See `docs/security.md`.

## 9. Testing results

```
apps/api: 18/18 vitest tests passed
Coverage includes: register, auth, game create, invite validate/disable/expire,
consent gate, skip/private/share, submit, duplicate submit, receipt access,
creator cannot see private answers via API, IDOR block, deletions.
```

Frontend production build succeeded (`tsc -b && vite build`).

## 10. Known limitations

- Local DB is SQLite (no Docker/Postgres on this machine)  
- Invite raw token is shown from create response / browser session cache (by design for hash-at-rest)  
- Email verification is not wired to an ESP  
- No real-time multiplayer; async link-based only  
- AI insights intentionally omitted  

## 11. Run locally

See root `README.md`.

## 12. Deploy

See `docs/DEPLOYMENT.md`.

## 13. Complete vs simulated vs pending

- **Complete:** core product loop, privacy enforcement, UI experiences, tests, docs  
- **Simulated:** email verification auto-pass in development; demo fictional respondent “Jordan”  
- **Pending:** hosted Postgres, ESP, CDN production secrets, optional AI  
