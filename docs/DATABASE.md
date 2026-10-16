# Database

PostgreSQL (Supabase). Schema source: `src/server/db/schema/*.ts`. All PKs `uuid` (`gen_random_uuid()`), all timestamps `timestamptz`, every table has `created_at`; mutable tables have `updated_at`.

## Conventions
- **Tenant tables** carry `org_id` and a `unique (org_id, id)` constraint. Children reference parents with **composite FKs** `(org_id, parent_id) → parent(org_id, id)`, so a row cannot reference a parent in another org.
- Historical data uses `ON DELETE RESTRICT`. Lifecycle via `status` / `archived_at` / `ended_on`, not deletes.
- Enums as Postgres enums (listed below).
- Locale-neutral storage: money as integer minor units + ISO 4217 currency, phone numbers in E.164, instants as `timestamptz` (UTC), recurring times as local `time` + the org's IANA timezone.
- Every table has RLS enabled (policies: [SECURITY.md](SECURITY.md); rules: [ROLES-PERMISSIONS.md](ROLES-PERMISSIONS.md)).

## Entity relationships
```
auth.users 1─1 profiles
organizations 1─* memberships *─1 profiles
organizations 1─* invitations
organizations 1─* subjects / grade_levels / locations
organizations 1─* students ─(user_id, nullable)─ profiles
students 1─* student_claim_codes
classes *─1 subject, grade_level, location?
classes 1─* class_teachers *─1 memberships
classes 1─* enrolments *─1 students
classes 1─* class_schedules 1─* class_sessions (sessions may also be ad hoc)
class_sessions 1─* attendance_records *─1 students
classes 1─* lessons 1─* resources
classes 1─* assignments 1─* submissions *─1 students; submissions 1─* submission_files
classes 1─* assessments 1─* assessment_results *─1 students
organizations 1─* announcements (class_id nullable)
organizations 1─* audit_log
```

## Tables
### Identity & tenancy
| Table | Key columns | Constraints / notes |
|---|---|---|
| `profiles` | id (= auth.users.id), full_name, phone, locale, avatar_path | Created by trigger on auth signup |
| `organizations` | name, slug, kind `org_kind`, country (ISO 3166-1 alpha-2), timezone (IANA), currency (ISO 4217), default_locale (BCP 47), week_start (0–6), archived_at | slug unique; all required, set at creation (no country defaults in schema); future: plan fields |
| `memberships` | org_id, user_id, role `member_role`, status `member_status`, joined_at | unique (org_id, user_id); trigger: ≥1 active owner per org |
| `invitations` | org_id, email (lowercase), role (admin/teacher), token_hash, invited_by, expires_at, accepted_at, accepted_by, revoked_at | token stored as SHA-256 only (not user-selectable); role ≠ owner; 7-day expiry |
| `audit_log` | id (bigserial), org_id, actor_id, action, entity_type, entity_id, metadata jsonb | Append-only: written only by SECURITY DEFINER functions in the same transaction as the change; no PII in metadata |

### Catalogue
| `subjects` | org_id, name, code, archived_at | unique (org_id, lower(name)) |
|---|---|---|
| `grade_levels` | org_id, name, sort_order, archived_at | seeded at org creation from an education-system template (static config in code, e.g. generic, LK, UK, US, IN); editable per org |
| `locations` | org_id, name, kind `location_kind`, address, archived_at | |

### Students & classes
| Table | Key columns | Constraints / notes |
|---|---|---|
| `students` | org_id, user_id?, full_name, student_code, grade_level_id?, school, guardian_name, guardian_phone, date_of_birth?, status, archived_at | unique (org_id, user_id) where user_id not null; unique (org_id, student_code) |
| `student_claim_codes` | org_id, student_id, code_hash, created_by, expires_at, used_at | one active code per student |
| `classes` | org_id, name, subject_id, grade_level_id, location_id?, type `class_type`, academic_year, capacity?, status, fee_amount?, fee_period? (R2) | individual ⇒ capacity = 1 (check) |
| `class_teachers` | org_id, class_id, membership_id, role `class_teacher_role`, started_on, ended_on? | unique active (class_id, membership_id) |
| `enrolments` | org_id, class_id, student_id, status `enrolment_status`, started_on, ended_on? | unique active (class_id, student_id) (partial index) |

### Timetable & attendance
| `class_schedules` | org_id, class_id, weekday (0–6), start_time, end_time, location_id?, effective_from, effective_to? | end > start |
|---|---|---|
| `class_sessions` | org_id, class_id, schedule_id?, starts_at, ends_at, location_id?, status `session_status`, note | unique (schedule_id, starts_at) |
| `attendance_records` | org_id, session_id, student_id, status `attendance_status`, marked_by, marked_at | unique (session_id, student_id) |

### Teaching content
| `lessons` | org_id, class_id, title, body (rich text JSON), published_at?, author_id, sort_order | |
|---|---|---|
| `resources` | org_id, class_id, lesson_id, kind `resource_kind`, title, storage_path?, mime_type?, size_bytes?, url?, video_provider?, video_external_id? | check fields by kind |
| `assignments` | org_id, class_id, title, instructions, due_at, max_marks?, published_at?, author_id | |
| `submissions` | org_id, assignment_id, student_id, body, submitted_at, status `submission_status`, marks?, feedback?, graded_by?, graded_at? | unique (assignment_id, student_id) |
| `submission_files` | org_id, submission_id, storage_path, mime_type, size_bytes | |
| `assessments` | org_id, class_id, title, kind `assessment_kind`, held_on, max_marks, published_at? | |
| `assessment_results` | org_id, assessment_id, student_id, marks?, absent bool, remarks | unique (assessment_id, student_id); marks ≤ max |
| `announcements` | org_id, class_id?, title, body, author_id, published_at | |

## Enums
`org_kind`: individual, institute · `member_role`: owner, admin, teacher · `member_status`: active, inactive · `location_kind`: institute, hall, home, online · `class_type`: group, individual · `class_teacher_role`: lead, assistant · `enrolment_status`: active, completed, withdrawn · `session_status`: scheduled, held, cancelled · `attendance_status`: present, absent, late, excused · `resource_kind`: file, link, video · `submission_status`: submitted, graded, returned · `assessment_kind`: quiz, test, exam.

## Session generation
Sessions are materialised from schedules for a rolling window (e.g. 8 weeks ahead) when a schedule is created/changed, and topped up on access to the timetable. Editing a schedule only affects future sessions without attendance.
