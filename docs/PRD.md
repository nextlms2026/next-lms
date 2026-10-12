# next-lms — Product Requirements

## Vision
A modern, trustworthy web platform where independent tutors and tuition institutes **in any country** run their teaching — classes, students, timetables, attendance, materials, homework, and marks — and students access everything for their classes in one place.

**Global by default:** nothing is tied to one country. Country, timezone, currency, language, grade system, and week start are per-organisation settings; education-system specifics (e.g. Grades 1–13 + O/L/A/L, UK Years + GCSE/A-Level, US K–12, Indian Classes 1–12) come from editable templates, not code.

## Users
| User | Context | Primary need |
|---|---|---|
| Independent teacher | Teaches several subjects/grades across halls/institutes; often not highly technical | Fast daily operations: today's classes, attendance, sharing materials, marks |
| Institute owner/admin | Runs an institute with many teachers | Manage teachers, classes, students centrally |
| Teacher at an institute | Assigned to specific classes | Same as independent teacher, limited to assigned classes |
| Student (often a minor, mobile-first, may have no email) | Attends several classes, possibly from different providers | See timetable, materials, homework, marks |

Roles and permissions: see [ROLES-PERMISSIONS.md](ROLES-PERMISSIONS.md).

## Core concepts
- **Organisation** — the tenant. `individual` (solo teacher workspace) or `institute`. Same model; a solo workspace can grow into an institute.
- **Member** — a staff user in an org (owner/admin/teacher). A person can be a member of several orgs.
- **Student** — an org-owned record, created by staff, optionally linked to a login once claimed. One person can be a student in several orgs with one login.
- **Class** — subject + grade + (optional) location + type (`group` / `individual`), owned by the org, taught by assigned teachers.
- **Enrolment** — a student's time-bounded membership of a class.
- **Session** — a concrete dated class meeting, generated from a recurring schedule or added ad hoc. Attendance belongs to sessions.

## Business rules
1. A teacher can teach many subjects and grades; a subject+grade can have many classes (different locations, times, fees).
2. Group and individual tuition are both classes; individual = `type individual` (capacity 1).
3. Students may enrol in many classes, across teachers and across organisations.
4. Each class has its own schedule, sessions, enrolments, attendance, lessons, homework, tests, and results.
5. A student's identity/details are one record per org, shared across that org's classes.
6. Data never crosses organisations. A student enrolled in Org A and Org B sees both on their dashboard, but Org A staff never see Org B data.
7. Learning materials, submissions, marks, attendance, and personal data are visible only to authorised users (see ROLES-PERMISSIONS).
8. Historical records are preserved: withdrawing a student ends the enrolment; teacher departure deactivates the membership; classes/students are archived, not deleted.
9. Students see content only for **active** enrolments; they keep seeing their own past marks and attendance after withdrawal.
10. Sensitive administrative actions are audited (list in SECURITY.md).
11. Each org has exactly ≥1 owner; the last owner cannot leave or be demoted.
12. Fees are designed for but not built in Release 1 (classes carry optional fee config in the org's currency; R2 adds fee records per period).
13. Each organisation sets its country, timezone, currency, default language, and week start at creation (prefilled from the browser, changeable later). All dates display in the org's timezone; students in several orgs see each class in its org's timezone.
14. Grade levels are org-owned and seeded from a chosen education-system template; orgs can rename, add, or reorder them.

## Edge cases (must be handled by design)
- **Withdraw / rejoin:** withdrawal sets enrolment `status=withdrawn, ended_on`; rejoining creates a new enrolment row. History stays intact.
- **Mid-term enrolment:** attendance and stats only count sessions within the enrolment window.
- **Teacher leaves:** membership `status=inactive`; class assignments ended; classes reassigned by owner/admin; authored content remains with author shown.
- **Cancelled / extra sessions:** sessions can be cancelled (kept, excluded from attendance %) or added ad hoc.
- **Academic year rollover:** archive old classes; "duplicate class" copies setup (not enrolments/content by default).
- **Same person in two orgs** (as student, or teacher in own workspace + institute): one login, org switcher for staff, aggregated dashboard for students.
- **Mark/attendance corrections:** allowed; edits after the grace period are audited.
- **Ownership transfer:** owner promotes another member to owner, then may step down.
- **Account deletion:** profile anonymised; org-owned academic records retained and unlinked.
- **Student without email:** username login; password reset via staff reissuing a claim code.
- **Online classes across timezones:** a tutor and student in different countries — sessions are stored as absolute instants; the student's view can show both org time and their local time.
- **Org changes timezone:** existing sessions keep their absolute times; future generated sessions follow the new timezone.

## Out of scope for Release 1
See [MVP.md](MVP.md) for scope and [ROADMAP.md](ROADMAP.md) for later releases.
