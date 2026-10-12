# Decision Log

Format: context → decision → consequences. Newest at the bottom. Status: Accepted unless noted.

## ADR-001 Organisation as the single tenant model (2026-10-11)
**Context:** Must support solo teachers and multi-teacher institutes without a later rewrite.
**Decision:** Every workspace is an `organization` (`kind` individual/institute). Staff join via `memberships`; classes belong to the org; teachers are assigned per class.
**Consequences:** One code path for both cases; solo → institute is a setting change. All tenant tables carry `org_id`.

## ADR-002 Org-scoped student records, global login (2026-10-11)
**Context:** Students attend classes across teachers and organisations; many lack email.
**Decision:** `students` rows belong to an org and may exist without a login. Staff issue a one-time claim code; the student links it to a new or existing account (email or username). One person = one login linked to many student records.
**Consequences:** Orgs own their academic data and stay isolated; student dashboard aggregates across orgs. Username accounts use an internal non-routable email and staff-assisted password reset.

## ADR-003 Drizzle with RLS-enforcing transactions (2026-10-11)
**Context:** Drizzle connects with a privileged role and bypasses RLS; we want both typed queries and DB-level enforcement.
**Decision:** All request-scoped queries go through `db.rls(claims, fn)` which sets `role authenticated` + JWT claims per transaction. A narrow `dbAdmin` exists for listed call sites only.
**Consequences:** RLS is a real backstop for app bugs. Slight per-request overhead (one transaction). Migrations via drizzle-kit with hand-written SQL for policies.

## ADR-004 Three staff roles, no custom permission system in R1 (2026-10-11)
**Decision:** owner / admin / teacher + student; class-level lead/assistant. Parent role deferred to R2.
**Consequences:** Simple, testable matrix (ROLES-PERMISSIONS.md). Custom permissions can be added later as role → capability mapping.

## ADR-005 Fees designed for, built in R2 (2026-10-11)
**Decision:** Classes carry nullable fee fields; enrolments have status. Fee records and paid-month content gating come in R2.

## ADR-006 Cloud Supabase dev project instead of local Docker (2026-10-11)
**Context:** Docker not installed; user preferred not to install it.
**Decision:** Use a free cloud `nextlms2026-dev` project for local dev and RLS tests; `nextlms2026-prod` for production. No staging environment initially.
**Consequences:** No offline dev; tests use prefixed fixtures with cleanup; Vercel previews share dev data. Can adopt Docker + `supabase start` later without code changes.

## ADR-007 English first, i18n-ready (2026-10-11)
**Decision:** next-intl with `messages/en.json` from day one; further languages (including RTL) added as markets require.

## ADR-008 Video provider-independent; embeds only in R1 (2026-10-11)
**Decision:** `resources` store `video_provider` + `video_external_id`. R1 supports YouTube/Vimeo embeds, flagged as not access-controlled. Secure provider evaluated (with costs) later.

## ADR-009 Offline tests in R1, online quizzes in R2 (2026-10-11)
**Decision:** R1 records marks for tests held in class; auto-graded online quizzes deferred.
**Consequences:** Much smaller R1; `assessments` table extends later with questions/attempts.

## ADR-010 Global by default (2026-10-12)
**Context:** The product targets tutors and institutes in any country, not only Sri Lanka.
**Decision:** Country, timezone, currency, locale, week start, and grade system are per-org settings chosen at creation (no country defaults in the schema). Education systems are seed templates, not code paths. Storage is locale-neutral (UTC instants, ISO codes, E.164 phones, minor-unit money). Privacy follows a multi-jurisdiction baseline (SECURITY.md).
**Consequences:** Slightly longer onboarding (country step, prefilled). Payment, SMS, and video providers must be pluggable per region later. Marking/grading scales stay numeric marks in R1; configurable grade scales (A–F, percentages, GPA) are a later addition.

## ADR-011 Next.js 16 with Cache Components; no server caching of tenant data (2026-10-12)
**Context:** create-next-app 16.4 enables Cache Components and Partial Prefetching by default. Almost every next-lms page is per-user and RLS-filtered.
**Decision:** Keep the framework defaults. Session reads sit inside `<Suspense>`; `'use cache: private'` (browser-only) is allowed for session helpers. `'use cache'` / `'use cache: remote'` must not wrap tenant or personal data unless reviewed and keyed safely.
**Consequences:** Static shells stay fast while authenticated content streams in. Slightly more Suspense boundaries. Prevents cross-user cache leaks.

## ADR-012 ESLint guards the RLS-bypass boundary (2026-10-12)
**Decision:** `no-restricted-imports` forbids importing `@/server/db/admin` and `@/server/db/client` outside `src/server/db/`, except files in `adminDbAllowlist` (`eslint.config.mjs`), which must mirror SECURITY.md.
**Consequences:** Accidental RLS bypass fails lint/CI instead of relying on review.
