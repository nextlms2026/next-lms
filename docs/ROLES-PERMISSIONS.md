# Roles & Permissions (single source of truth)

## Roles
| Role | Scope | Notes |
|---|---|---|
| **Owner** | Organisation | Full control; also has all teacher capabilities (solo teacher = owner). ≥1 per org. |
| **Admin** | Organisation | Operational management; cannot change org ownership/settings or manage other admins. |
| **Teacher** | Assigned classes | Lead or assistant per class (`class_teachers.role`); both have the same rights in R1. |
| **Student** | Own records, active-enrolment classes | Linked via claimed `students.user_id`; may be a student in several orgs. |

Not in R1: parent/guardian (R2), custom permission sets, read-only staff.

## Matrix
| Capability | Owner | Admin | Teacher | Student |
|---|---|---|---|---|
| Edit org settings, transfer ownership, archive org | ✅ | – | – | – |
| Invite / change role / deactivate **admins** | ✅ | – | – | – |
| Invite / deactivate **teachers** | ✅ | ✅ | – | – |
| View team list | ✅ | ✅ | ✅ (names only) | – |
| Manage subjects, grades, locations | ✅ | ✅ | read | – |
| Create class | ✅ | ✅ | ✅ (becomes lead) | – |
| Edit/archive class, assign teachers | ✅ | ✅ | own classes (cannot remove last lead) | – |
| Schedules, sessions, attendance | ✅ all | ✅ all | own classes | view own attendance |
| Lessons, resources, assignments, assessments | ✅ all | ✅ all | own classes | view published, active enrolments only |
| Enrol / withdraw students | ✅ | ✅ | own classes | – |
| Create student record | ✅ | ✅ | ✅ | – |
| View/edit student record | all | all | students actively enrolled in own classes (+ ones they created, until enrolled) | own (limited fields: phone) |
| Generate claim code | ✅ | ✅ | for students they can view | – |
| Submit homework | – | – | – | own, active enrolment, before grading |
| Grade submissions, enter marks | ✅ | ✅ | own classes | view own marks (persist after withdrawal) |
| Announcements | org-wide + any class | org-wide + any class | own classes | read relevant |
| View audit log | ✅ | ✅ | – | – |

"Own classes" = active `class_teachers` row for the caller's active membership.

## Enforcement
1. **UI** hides unavailable actions (convenience only).
2. **Server** `require*()` helpers (`src/server/authz.ts`) gate every page and action → `notFound()` on failure.
3. **RLS** policies implement this matrix in SQL via helper functions:
   - `app.is_org_member(org_id, roles member_role[])`
   - `app.is_class_teacher(class_id)` (true also for owner/admin of the class's org)
   - `app.is_class_student(class_id, active_only bool)`
   - `app.student_ids_for_user()` (students rows linked to `auth.uid()`)

   Functions are `security definer`, `stable`, `set search_path = ''`, and live in a non-exposed `app` schema.

Any change to this matrix must update RLS policies, `authz.ts`, and the permission tests in the same change.
