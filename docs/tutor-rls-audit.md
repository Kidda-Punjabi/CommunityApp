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

## Remaining over-broad tutor access (addressed in tutor-rls-remaining-gaps.sql)

| Table | Policy pattern | Fix |
|-------|----------------|-----|
| `cohort_members` | was `is_tutor()` unscoped | `tutor_can_manage_cohort(cohort_id)` |
| `package_instances` | read allowed any `is_tutor()` | assigned `tutor_id` / community_lead / master_admin |
| Storage `lesson-recordings` | `is_tutor()` unscoped | path must match assigned student or cohort |

Apply: `supabase/tutor-rls-remaining-gaps.sql` via SQL Editor or `scripts/apply-tutor-rls-remaining-gaps.ts`.


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
