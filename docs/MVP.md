# Release 1 (MVP) — Scope & Acceptance Criteria

Goal: a complete teacher ↔ student loop. A solo teacher can set up, run classes for a term, and students can follow along — with tenant isolation proven by tests.

## In scope
| # | Feature | Acceptance criteria |
|---|---|---|
| 1 | Auth & profile | Sign up (email+password, verified), log in/out, password reset, edit name/phone. Sessions refresh via middleware. |
| 2 | Organisation | After first login, create workspace (individual or institute) with country, timezone, currency, and grade template (prefilled from browser locale/timezone); creator becomes owner. Org switcher if member of several. |
| 3 | Team | Owner/admin invites by email with role; invitee accepts (new or existing account); owner/admin changes roles / deactivates; last owner protected. Actions audited. |
| 4 | Catalogue | CRUD subjects, grade levels (seeded from an education-system template chosen at org creation — Generic Grades 1–12, plus a few country templates; fully editable), locations (incl. "Online"). Archive instead of delete when in use. |
| 5 | Students | Add/edit/archive students (name, grade, school, guardian name/phone, optional DOB). Search + pagination. |
| 6 | Student claim & login | Staff generates single-use claim code (expires 14 days); student enters it at `/join`, sets email+password or username+password, or links to an existing login. Code invalid after use; attempts rate-limited. |
| 7 | Classes | Create group/individual class (subject, grade, location, academic year, capacity); assign lead/assistant teachers; archive. Teachers see only assigned classes. |
| 8 | Enrolments | Enrol/withdraw students; history kept; capacity enforced for individual classes. |
| 9 | Timetable | Recurring weekly schedules generate sessions; add/cancel single sessions; week view for staff and students. |
| 10 | Attendance | Mark present/absent/late/excused per session in one screen (default all-present, tap exceptions); student sees own record + %. |
| 11 | Lessons & materials | Lessons with rich text + resources (file upload, link, video embed); publish/unpublish; students of the class can view; downloads via signed URLs. Video embeds labelled "not access-controlled" to staff. |
| 12 | Homework | Create with due date + max marks; students submit text/files (resubmit until graded); teacher marks with feedback; late flag. |
| 13 | Tests & results | Record offline test/quiz/exam with max marks; bulk marks entry grid; student sees own results. |
| 14 | Announcements | Org-wide or class announcement; visible to relevant students/staff. |
| 15 | Dashboards | Teacher "Today": today's sessions with attendance shortcut, homework to mark. Student home: next class, homework due, new materials, recent results. |

Cross-cutting acceptance for every feature: RLS + isolation tests, Zod validation, loading/empty/error states, responsive (phone for students), English strings in `messages/en.json`.

## Explicitly not in Release 1
Fee records, online auto-graded quizzes, progress charts/reports, email/push notifications (beyond auth + invitations), parent accounts, CSV import, UI languages other than English, payments, subscriptions, SMS/WhatsApp, secure video hosting, AI features.
