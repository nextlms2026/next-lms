# next-lms — Claude Code Instructions

Multi-tenant LMS for independent tutors and tuition institutes in any country. Read the relevant `docs/` file before working on a feature; docs + code are the source of truth. If they conflict, flag it, don't silently pick one.

| Need | Read |
|---|---|
| What & why, business rules | [docs/PRD.md](docs/PRD.md) |
| Release 1 scope & acceptance criteria | [docs/MVP.md](docs/MVP.md) |
| Stack, data access, request flow | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Tables, relationships, constraints | [docs/DATABASE.md](docs/DATABASE.md) |
| Who can do what (single source) | [docs/ROLES-PERMISSIONS.md](docs/ROLES-PERMISSIONS.md) |
| Threat model, RLS, storage, admin-client usage | [docs/SECURITY.md](docs/SECURITY.md) |
| Navigation, design system, journeys | [docs/UI-UX.md](docs/UI-UX.md) |
| Milestones & progress | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Why decisions were made | [docs/DECISIONS.md](docs/DECISIONS.md) |

## Stack
Next.js 16 App Router (Cache Components on) · TypeScript strict · Supabase (Postgres, Auth, Storage) · Drizzle ORM · Tailwind v4 + shadcn/ui (radix-nova) · Zod 4 · React Hook Form · next-intl · Vitest · Playwright · npm · Vercel.

@AGENTS.md

Next.js 16 differs from older versions: middleware is `src/proxy.ts`; session reads must be inside `<Suspense>`; never `'use cache'` tenant data (ADR-011). Check `node_modules/next/dist/docs/` before using unfamiliar Next APIs.

## Commands
`npm run dev` · `npm run check` (typecheck + lint + unit tests + build) · `npm run test:e2e` · `npm run db:check` (verify env + DB + RLS switch) · `npm run db:generate` / `db:migrate` · `npm run format`

## Non-negotiable rules
1. **All request-scoped DB access goes through `db.rls(fn)`** from `@/server/db` (RLS enforced). The RLS-bypassing `getAdminDb()` may only be used in the call sites listed in SECURITY.md §Admin client; adding one = update that list + `adminDbAllowlist` in `eslint.config.mjs` + justify.
2. **Every server action:** Zod parse → `require*()` authz helper → RLS-scoped query → audit if listed in SECURITY.md. Never trust IDs, `org_id`, or roles sent by the client; derive them server-side.
3. **Every new tenant table:** `org_id` column, composite FK `(org_id, parent_id)` to its parent, RLS enabled with policies, and isolation tests. No table ships without RLS.
4. Inaccessible resources → `notFound()` (404), not 403.
5. Service-role key and DB URL are server-only (`import 'server-only'`); never `NEXT_PUBLIC_`. Server env via `@/env/server`, public env via `@/env/client` (both Zod-validated).
6. Historical records (attendance, results, submissions, enrolments) are never hard-deleted — archive / end-date instead.
7. Schema changes only via migrations in `drizzle/` (generated or hand-written SQL). Never edit schema in the Supabase dashboard.
8. Private files only via access-checked route handler issuing short-lived signed URLs.
9. User-facing strings go through next-intl message files (`messages/en.json`).
10. Don't log PII, tokens, passwords, or file contents.
11. **No country-specific hardcoding.** Timezone, currency, locale, country, grade system, and week start come from org settings. Use `Intl` for dates/numbers/currency, ISO codes (country 3166-1, currency 4217, IANA timezones), E.164 phone numbers, and CSS logical properties (RTL-ready).

## Code conventions
- No `any` without a comment explaining why. Prefer inferred Drizzle/Zod types.
- Feature folders: `src/features/<feature>/{actions.ts, queries.ts, schema.ts, components/}`; shared UI in `src/components/ui` (shadcn).
- Business logic in `features/*` server modules, not in components or pages.
- Dates stored `timestamptz`; display in the org's timezone (chosen at org creation, prefilled from the browser).
- Server actions return `{ ok: true, data } | { ok: false, error }` — never throw raw DB errors to the client.

## Workflow (per milestone)
1. Read relevant docs; confirm objective + acceptance criteria.
2. Smallest complete vertical slice: migration + RLS → server logic → UI → tests.
3. Run `npm run typecheck && npm run lint && npm test && npm run build`; report real results only.
4. Review security/regressions; update docs + ROADMAP; add ADR to DECISIONS if a significant choice was made.
5. Summarise and propose next step. **No git commits without the user's permission.** Ask before any paid service.

## Definition of done
Migration applied to dev · RLS policies + isolation tests passing · Zod validation on all inputs · loading/empty/error states · typecheck/lint/test/build green · docs updated.
