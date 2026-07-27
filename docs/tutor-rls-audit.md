# Tutor RLS audit (report-only)

Audit date: 2026-07-27. Scope: admin-facing tables where tutors have missing or over-broad RLS.

## Fixed in `supabase/tutor-rls-scoping-fixes.sql`

| Table | Issue | Fix |
|-------|-------|-----|
| `cohort_lesson_log_entries` | Tutor SELECT only; no INSERT/UPDATE | Tutor insert/update via `tutor_can_manage_lesson_log_entry()` |
| `student_packages` | No tutor access | Tutor SELECT/UPDATE via `tutor_can_access_student_package()` |
| `cohorts` | `is_tutor()` alone on read/manage | `tutor_can_manage_cohort(id)` |
| `tutor_can_manage_cohort()` | `OR is_tutor()` bypassed all cohorts | Removed blanket tutor bypass |

## Correctly scoped (do not change)

- `cohort_lesson_attendance`, `cohort_lesson_homework` — `tutor_can_manage_cohort(cohort_id)`
- `onboarding_checklists` — `tutor_can_access_student_package(student_package_id)`
- `cohort_lesson_unlocks` — `tutor_can_manage_cohort(cohort_id)` (in `tutor-cohort-assigned-read.sql`)

## Remaining over-broad tutor access (not changed in this pass)

| Table | Policy pattern | Risk |
|-------|----------------|------|
| `cohort_members` | `Staff read/manage cohort members` uses `is_tutor()` with no cohort assignment check | Any tutor can read/edit all cohort rosters |
| `package_instances` | Multiple policies use `is_tutor()` alone (`package-instances-and-schema-fixes.sql`, `cohort-package-management-revamp.sql`) | Any tutor can read/manage all 1-1 package instances |
| `course_enrollments` | Tutors can only manage rows where `tutor_id = auth.uid()` — **correctly scoped** | — |
| `student_lesson_unlocks` | Scoped to enrollment tutor — **correct** | — |
| `lesson_recordings` | Updated in `tutor-cohort-assigned-read.sql` to use `tutor_can_manage_cohort` — **likely OK if that migration ran** | Verify prod has assigned-read version, not base `tutor-cohort-access.sql` |
| Storage `lesson-recordings` | `is_tutor()` on upload/update/delete | Any tutor can mutate any recording object path |
| Notion admin tables (`notion_tutor_map`, sync cursors, etc.) | Staff-wide or master_admin only | Tutors typically blocked — OK unless a tutor workflow needs them |

## Remaining missing tutor access (not changed in this pass)

| Table | Notes |
|-------|-------|
| `packages` | Catalog read only for tutors — likely intentional |
| Notion mirror tables | Intentionally service-role / master_admin for sync |

## App vs package onboarding

| Concept | Storage | Admin UI |
|---------|---------|----------|
| **Package onboarding** | `onboarding_checklists` per `student_package_id` | `/admin/onboarding` — checklist columns |
| **App onboarding** | `profiles.has_seen_onboarding` | Same page — “App onboarding” column |

No new table required for app onboarding; it is independent of purchase.

## Recommended follow-up (separate PR)

1. Tighten `cohort_members` staff policies to `tutor_can_manage_cohort(cohort_id)`.
2. Tighten `package_instances` tutor policies to assigned `tutor_id` only.
3. Tighten storage policies for `lesson-recordings` to match recording row scope.
4. Confirm prod policy versions for `cohort_lesson_unlocks` and `lesson_recordings` match `tutor-cohort-assigned-read.sql`.
