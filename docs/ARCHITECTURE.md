# Architecture

## Overview
```
Browser ──► Next.js 16 on Vercel (App Router, Cache Components)
              ├─ src/proxy.ts (Next 16 "proxy" = old middleware): refresh Supabase session cookie
              ├─ Server Components (reads)  ─┐
              ├─ Server Actions (mutations) ─┼─► db.rls(user) ─► Supabase Postgres (RLS enforced)
              ├─ Route handlers (auth callback, file download/upload URLs)
              └─ dbAdmin (server-only, narrow list) ─► Postgres (bypasses RLS)
            Supabase Auth  (sessions, email verification, password reset)
            Supabase Storage (private buckets, signed URLs)
```
One deployable Next.js app. No separate API server, queue, or cache in Release 1.

## Data access (key decision — see ADR-003)
Drizzle connects as a privileged role, which bypasses RLS. To keep RLS as a real defence layer:
- `db.rls(fn)` (`src/server/db/index.ts`) gets the caller's claims via `getVerifiedClaims()` (Supabase `getClaims()`, which verifies the JWT signature), opens a transaction, sets `request.jwt.claims` and `role` (`authenticated`, or `anon` when signed out) with transaction-local `set_config`, then runs `fn(tx)`. Supabase's `auth.uid()` inside policies resolves to the user. Callers never pass claims, so they cannot be forged; `toRlsSettings` refuses any other JWT role (e.g. `service_role`).
- `getAdminDb()` (`src/server/db/admin.ts`) bypasses RLS and is restricted to the call sites listed in SECURITY.md. **ESLint enforces this:** importing `@/server/db/admin` or the raw `@/server/db/client` outside `src/server/db/` is an error unless the file is in `adminDbAllowlist` in `eslint.config.mjs`.
- `npm run db:check` verifies env vars, API keys, both connection strings, and that the role switch works.
- Connection: Supabase transaction pooler (port 6543), `postgres` driver with `prepare: false`, small pool.
- Supabase JS client is used for **Auth and Storage only**.

## Request patterns
| Operation | Pattern |
|---|---|
| Page data | Server Component → `features/*/queries.ts` → `db.rls` |
| Mutation | Server Action → Zod → `require*()` → `db.rls` → `revalidatePath` → result union |
| File download | `GET /api/files/[resourceId]` → access check via `db.rls` → 60s signed URL redirect |
| File upload | Server Action checks access + type/size → returns signed upload URL → client uploads directly to Storage → action records the row |
| Email links (confirm, recovery) | `GET /auth/confirm` handles `token_hash` (recommended template, any device), `code` (default template; email already verified by Supabase — if the session step fails on another device, signup shows "confirmed, sign in", recovery shows an error) and Supabase `error` params → `safeRedirectPath(next)` |
| Entry & optimistic routing | `src/proxy.ts`: `/` → `/login` or `/dashboard`; signed-in users skip auth pages; signed-out users on app pages → `/login?next=…`. UX only — pages and RLS still enforce access. No public landing page in the app (a marketing site, if wanted, lives separately). |
| Post-login routing | `/dashboard` **page** (not a route handler — the client router follows handler redirects without updating the URL) → `/onboarding`, `/o/[slug]` or `/orgs` |
| Forms | Client form + `useActionState` + Server Action returning `FormState` (message keys, echoed values); Zod runs on the server. React Hook Form reserved for complex dynamic forms (e.g. marks grid) — ADR-014 |

Authz helpers (`src/server/authz.ts`): `requireUser()`, `requireOrgRole(orgSlug, roles)`, `requireClassAccess(classId, mode)`, `requireStudentSelf()`. They resolve the org from the URL slug + membership, return typed context, and call `notFound()` on failure. They are UX-level/early-exit checks; RLS is the backstop.

## Next.js 16 specifics
- **Proxy** (`src/proxy.ts`) replaces middleware. It only refreshes sessions; it is not authorization.
- **Identity is request-time:** `getVerifiedClaims()` calls `await connection()` so session checks never run inside a prerender/prefetch.
- Sign-in gated layouts export `instant = false` (an auth redirect can never pass dev instant-navigation validation).
- **Cache Components** is on. Anything reading cookies/session must render inside `<Suspense>` (build error otherwise). Session-dependent helpers may use `'use cache: private'`.
- **No `'use cache'` / `'use cache: remote'` on tenant data** without explicit review: a shared server cache could serve one user's RLS-filtered rows to another, and cache keys are stored in plain text (ADR-011).
- Docs for this exact version are bundled in `node_modules/next/dist/docs/` — read them before using unfamiliar APIs (see AGENTS.md).

## Folder layout
```
src/
  app/
    (auth)/login, signup, reset, join
    o/[orgSlug]/...        staff app
    s/...                  student app
    api/files/[id]/route.ts
    auth/callback/route.ts
  proxy.ts                 session refresh only
  features/<feature>/{actions.ts, queries.ts, schema.ts, components/}
  server/
    db/{index.ts (db.rls), admin.ts, client.ts, rls-settings.ts, schema/*.ts}
    auth.ts (getVerifiedClaims), supabase.ts, authz.ts, audit.ts
  components/ui/           shadcn (radix-nova style, RTL-enabled)
  lib/                     pure utilities; lib/supabase/browser.ts (Auth/Storage only)
  i18n/{config.ts, request.ts}
  env/{client.ts, server.ts, schema.ts}   Zod-validated env; server.ts is server-only
drizzle/                   migrations (generated + hand-written RLS SQL)
messages/en.json
scripts/db-check.ts
tests/{unit, rls, e2e}
```

## Migrations
Schema in `src/server/db/schema/*.ts`. `drizzle-kit generate` → SQL in `drizzle/`. RLS policies, `security definer` helper functions, triggers, and storage policies go in hand-written SQL migrations (`drizzle-kit generate --custom`). Apply with `drizzle-kit migrate` to dev, then prod (manual step at release). All migrations committed.

## Environments
| Env | Supabase | App | Notes |
|---|---|---|---|
| Local | `nextlms2026-dev` cloud project (free) | `npm run dev` | No Docker (ADR-006). Vercel preview deployments also use dev. |
| Production | `nextlms2026-prod` (free → Pro before real data) | Vercel production | Migrations applied deliberately; backups require Pro. |
Secrets live in `.env.local` (git-ignored) and Vercel env settings. `.env.example` documents keys: `DATABASE_URL` = transaction pooler (6543, app runtime); `DATABASE_MIGRATION_URL` = session pooler (5432, drizzle-kit and scripts) — optional; derived from `DATABASE_URL` by switching to port 5432 when unset, and never needed on Vercel. The direct connection is IPv6-only on the free plan, so it is not used.

## i18n
next-intl, English only in R1, strings in `messages/en.json`. Locale-aware date/number formatting via `Intl` with org timezone.

## Email
Auth emails + invitations via Supabase Auth. Dev uses built-in SMTP (rate-limited). Prod requires custom SMTP (Resend candidate; approval needed before signup).
