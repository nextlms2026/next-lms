# Roadmap

Status: ⬜ not started · 🟡 in progress · ✅ done

## Release 1 milestones
Each milestone is a vertical slice (migration + RLS + server + UI + tests). Scope details: [MVP.md](MVP.md).

| # | Milestone | Depends on | Status |
|---|---|---|---|
| M0 | Foundation docs + CLAUDE.md | – | ✅ |
| M1 | Scaffold: Next.js, TS strict, Tailwind/shadcn, ESLint/Prettier, Vitest/Playwright, env validation, Supabase dev wiring, Drizzle + `db.rls`, `git init` | M0; user creates Supabase dev project | ✅ |
| M2 | Auth, profiles, org creation, memberships, RLS helper functions, first isolation tests, app shell | M1 | ⬜ |
| M3 | Team: invitations, roles, deactivation, audit log | M2 | ⬜ |
| M4 | Catalogue: subjects, grades (seeded), locations | M2 | ⬜ |
| M5 | Students, classes, teacher assignment, enrolments, claim codes, student login | M3, M4 | ⬜ |
| M6 | Schedules → sessions, timetable, Today screen, attendance | M5 | ⬜ |
| M7 | Lessons, resources, storage, signed downloads, video embeds | M5 | ⬜ |
| M8 | Homework: assignments, submissions, marking | M7 | ⬜ |
| M9 | Tests & results, announcements, student dashboard | M6, M8 | ⬜ |
| M10 | Hardening: security review, E2E suite, prod Supabase, Vercel deploy, custom SMTP, domain | M9 | ⬜ |

## Release 2 (candidates)
Fee records + optional "paid months only" content gating · online auto-graded MCQ quizzes · progress reports/charts · email notifications · parent/guardian access · CSV student import · additional UI languages (incl. RTL) · configurable grading scales (A–F, %, GPA) · org reporting dashboard.

## Future
Payments via a pluggable gateway layer (Stripe as default + regional gateways where Stripe is unavailable, e.g. PayHere, Razorpay) · SaaS subscriptions & plans with multi-currency pricing · SMS/WhatsApp · secure video provider · AI-assisted learning · PWA/offline.

## Open items / risks
- Supabase free tier pauses after 7 days idle and has no backups → upgrade prod to Pro (~US$25/mo) before real student data. (Decide at M10.)
- Custom SMTP provider for prod (Resend free tier likely) — needs approval at M3/M10.
- RLS tests run against remote dev DB (slower; fixtures must clean up reliably).
- Domain name needed by M10.
- Prod Supabase region (data residency/latency for first target markets) — decide at M10.
- Legal: terms, privacy policy, DPA, and children's-data compliance review before public launch in each market.
