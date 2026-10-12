# UI / UX

## Principles
Task-first screens (every screen answers "what do I need to do now?"), minimal clicks for daily actions, plain language for non-technical teachers, mobile-first for students, no decorative charts or vanity cards.

## Navigation
**Staff** — `/o/[orgSlug]/…`, sidebar on desktop, bottom/drawer on mobile, org switcher in header:
- Today · Classes · Students · Timetable · Announcements · Settings (Organisation, Team, Subjects & Grades, Locations)
- Class page tabs: Overview · Sessions & Attendance · Lessons · Homework · Tests & Marks · Students

**Student** — `/s/…`, bottom tab bar on mobile:
- Home · Classes · Timetable · Homework · Results

Auth: `/login`, `/signup`, `/reset`, `/join` (claim code), `/invite/[token]`. After login: staff with one org → that org; several → picker; students → `/s`; users with both → choice remembered.

## Key journeys
1. **Onboarding (teacher):** sign up → verify → create workspace (name, individual/institute, country → prefills timezone, currency, grade template) → guided checklist: add subject → create class + schedule → add students → share claim codes.
2. **Take attendance:** Today → session card → roster with everyone "present" by default → tap exceptions → save. Target < 30 s for 30 students.
3. **Share material:** Class → Lessons → New lesson → add file/link/video → publish.
4. **Homework loop:** teacher creates → student submits on phone → teacher marks with feedback → student sees mark.
5. **Student claim:** `/join` → code → choose email or username → password → privacy notice → home.

## Design system
- **Base:** shadcn/ui on Tailwind with CSS variable tokens; light mode default, dark mode via tokens.
- **Colour:** neutral slate surfaces; primary deep indigo-teal (trust, calm); saffron accent used sparingly (primary CTAs on onboarding, highlights, "today" markers); semantic success/warning/danger. All text ≥ WCAG AA contrast.
- **Type:** Inter; scale 12/14/16/20/24/30; tabular numbers for marks and attendance. Noto Sans script fallbacks (e.g. Sinhala, Tamil, Devanagari, Arabic) as locales are added.
- **Internationalisation:** dates, numbers, and currency via `Intl` in the org's locale/timezone; CSS logical properties (`ms-*`/`me-*`, `start`/`end`) so RTL languages work later; no text baked into images; layouts tolerate ~30% longer translated strings.
- **Spacing/shape:** 4px grid, 8px radius, subtle borders over heavy shadows.
- **Components:** page header (title + primary action), data table (search, filters, pagination, row actions), empty state (explains + offers next action), form layout (RHF + Zod, inline errors), confirm dialog for destructive/archive actions, toast for results, skeleton loaders, status badges (enrolment, session, submission).
- **Accessibility:** keyboard navigable, visible focus, labelled inputs, ARIA via Radix primitives, touch targets ≥ 44px on mobile.

Mockups of the Today screen, class page, and student home will be reviewed before M2 UI work.
