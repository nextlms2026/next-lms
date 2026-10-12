# Security

Permissions themselves are defined in [ROLES-PERMISSIONS.md](ROLES-PERMISSIONS.md); this file covers how they are enforced and what else we defend against.

## Assets & threats
Assets: student personal data (mostly minors), attendance, marks, submissions, private learning materials (often paid content), staff accounts.

| Threat | Mitigation |
|---|---|
| Cross-org data access / IDOR via changed IDs | Org derived server-side from slug + membership; RLS on every table; composite `(org_id, id)` FKs; 404 on denial; isolation tests |
| Teacher accessing unassigned classes/students | `is_class_teacher` in RLS + `requireClassAccess`; tests |
| Student accessing other students' data or unenrolled content | `is_class_student` / `student_ids_for_user` in RLS; tests |
| Privileged key leak | Service role + DB URL server-only (`server-only`, no `NEXT_PUBLIC_`), validated env, never logged |
| Invitation / claim code guessing or reuse | 128-bit random tokens, SHA-256 hashed at rest, single-use, expiry, rate-limited attempts |
| Account takeover | Supabase Auth (bcrypt, email verification, reset), min password length 8, built-in auth rate limits |
| Private file leakage | Private buckets, access check before 60s signed URL, storage RLS, no public URLs |
| Malicious uploads | MIME allowlist + size limits, files served as download (`Content-Disposition: attachment` for non-PDF/image), never rendered as HTML |
| XSS via rich text | Rich text stored as structured JSON (not HTML) and rendered via allowlisted components; CSP headers |
| CSRF | Server Actions (origin-checked by Next.js); SameSite cookies |
| Mass assignment | Zod schemas whitelist fields; `org_id`/`author_id`/roles set server-side |
| Leaky errors | Generic user messages; detailed server logs without PII |

## RLS policy pattern
- Enabled on **every** table in `public`; default deny.
- Staff read: `app.is_org_member(org_id, '{owner,admin}')` OR class-scoped `app.is_class_teacher(class_id)`.
- Student read: `app.is_class_student(class_id, true)` and `published_at is not null` for content; own-row checks via `student_id in (select app.student_ids_for_user())` for marks/attendance/submissions.
- Writes mirror the matrix, with `with check` preventing `org_id` changes.
- `anon` role has no table access.

## Admin client (RLS-bypassing) — allowed call sites
| Call site | Why it needs bypass |
|---|---|
| Invitation acceptance | Invitee is not yet a member; token verified first |
| Student claim | Claimer is not yet linked; code verified + rate-limited first; creates auth user for username logins |
| Audit log insert | Append-only table, no user-level insert policy |
| Test setup/teardown | Creating fixtures in RLS tests only |
Adding a call site requires updating this table **and** `adminDbAllowlist` in `eslint.config.mjs` (lint fails otherwise — ADR-012). Current allowlist: empty (M2).

## SECURITY DEFINER functions (privileged SQL, callable by `authenticated`)
| Function | Why | Guards |
|---|---|---|
| `app.create_organization(...)` | Creates org + caller-as-owner atomically; the caller is not yet a member, and users have no insert privilege on these tables | Requires `auth.uid()`; validates timezone; max 10 orgs per creator |
| `app.is_org_member(org, roles)` | RLS helper; reads memberships without recursive RLS | Read-only, `stable`, returns boolean only |
| `app.guard_last_owner()` (trigger) | Must see all owners regardless of caller RLS | Raises `last_owner` |
| `app.handle_new_user()` (trigger on `auth.users`) | Creates the profile row | Insert of id + name only |
All use `set search_path = ''`, live in the non-exposed `app` schema, and have `EXECUTE` revoked from `public`. Preferred over the admin client because the database itself enforces the rules (ADR-013).

## Table privileges
Beyond RLS, M2 revokes default Supabase grants: `anon` has no table access; `authenticated` gets `SELECT` plus column-level `UPDATE` only on user-editable columns (e.g. not `slug`, `id`, `created_at`). Inserts/deletes go through definer functions.

## Dependency notes
- `npm audit` (M1): 5 "high" findings, all one ReDoS advisory in `braces` via `eslint-config-next` → dev-only lint tooling, never shipped or run on user input. Suggested fix downgrades to Next 14 config, so accepted; re-check on each Next upgrade.

## Storage
Buckets: `materials` (private, 25 MB), `submissions` (private, 10 MB). Paths: `org/{org_id}/class/{class_id}/{lesson|assignment}/{id}/{uuid}-{filename}`. Allowlist: PDF, images (jpg/png/webp), Office docs, plain text, zip (materials only). Storage RLS mirrors table access using path segments. Downloads via `/api/files/[id]` → check → signed URL (60 s).

Video: R1 supports YouTube/Vimeo embeds stored as `video_provider` + `video_external_id`. **These are not access-controlled** — anyone with the link can watch. Staff UI warns about this. A signed-token provider (e.g. Bunny Stream / Cloudflare Stream) is a future, costed decision.

## Audited actions
Membership invite/accept/role change/deactivate · ownership transfer · claim code issued/used · enrolment create/withdraw · class archive · student archive · attendance or marks edited >24 h after first entry. Metadata stores IDs and changed field names, not personal data.

## Rate limiting
Supabase Auth built-in limits for auth endpoints. Postgres `rate_limit_attempts` table (key, window) for claim-code and invitation endpoints — no extra service.

## Privacy (multi-jurisdiction baseline)
Users can be anywhere, and many students are minors, so we build to a common baseline drawn from the strictest widely applicable laws: GDPR / UK GDPR, US COPPA (under-13s) and FERPA expectations, India DPDP Act 2023, Sri Lanka PDPA 2022, Australia Privacy Act.
- **Roles:** the organisation is the data controller for its students; next-lms is the processor. Terms + a data processing agreement come before public launch.
- **Minimisation:** no national ID numbers; DOB optional; guardian contact on the student record.
- **Minors:** staff create student records (not open self-signup), and the claim flow shows a privacy notice and asks for guardian confirmation when the student is under the org's configured age of digital consent (default 16).
- **Rights:** owners can export or delete a student's data on request. Profile deletion anonymises the user link while retaining org-owned academic records.
- **Data residency:** R1 runs in one Supabase region; the region is chosen when the prod project is created. Per-region hosting is a future decision if customers require it.
- Legal review is required before marketing in a new jurisdiction. This baseline is engineering guidance, not legal advice.

## Security testing
- `tests/rls/`: run against the dev Supabase project, with per-run fixtures (prefixed, cleaned up). Required cases per table: cross-org read/write denied; teacher denied on unassigned class; student denied on other students and unenrolled/unpublished content; anon denied; `org_id` change denied.
- Unit tests for authz helpers, token hashing, Zod schemas.
- E2E: tampered-ID URLs render the generic "Page not found" with no data from other orgs. Note: because org pages stream behind `<Suspense>`, the HTTP status of a streamed `notFound()` may be 200; the content (and absence of data) is what is asserted.
- Mutation check: deliberately weakening a policy must make the RLS suite fail (done for `organizations_select_member` in M2).
- Pre-deploy checklist: `security-review`, `npm audit`, verify no service key in client bundle (grep `.next/static`), Supabase advisor (RLS/security lints) clean.
