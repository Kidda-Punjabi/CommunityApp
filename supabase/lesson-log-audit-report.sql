-- Read-only lesson-log audit for Arshdeep.
-- Safe to re-run. Does not insert, update, or delete anything.
--
-- "Future" uses Europe/London's calendar date.
-- Duplicates are the same cohort OR the same package on the same date.
-- Rows with a null cohort_id are not grouped together across packages.

-- 1. Open rows whose lesson_date is still in the future.
SELECT
  COALESCE(c.name, pi.name, '(unlinked)') AS target,
  e.lesson_date,
  e.created_at,
  e.source,
  e.status,
  e.lesson_title,
  e.id
FROM public.cohort_lesson_log_entries e
LEFT JOIN public.cohorts c ON c.id = e.cohort_id
LEFT JOIN public.package_instances pi ON pi.id = e.package_instance_id
WHERE e.dismissed_at IS NULL
  AND e.lesson_date > (timezone('Europe/London', now()))::date
ORDER BY e.lesson_date, e.created_at;

-- 2. Open rows saved before the lesson date (logged ahead).
SELECT
  COALESCE(c.name, pi.name, '(unlinked)') AS target,
  e.lesson_date,
  (e.created_at AT TIME ZONE 'Europe/London')::date AS saved_on_london,
  e.lesson_date - (e.created_at AT TIME ZONE 'Europe/London')::date AS days_early,
  e.source,
  e.status,
  e.lesson_title,
  e.id
FROM public.cohort_lesson_log_entries e
LEFT JOIN public.cohorts c ON c.id = e.cohort_id
LEFT JOIN public.package_instances pi ON pi.id = e.package_instance_id
WHERE e.dismissed_at IS NULL
  AND (e.created_at AT TIME ZONE 'Europe/London')::date < e.lesson_date
  AND e.lesson_date >= (timezone('Europe/London', now()))::date - 60
ORDER BY days_early DESC, e.lesson_date DESC;

-- 3. Real duplicate groups: one class or one package, one date, more than one open row.
SELECT
  COALESCE(c.name, pi.name, '(unlinked)') AS target,
  e.lesson_date,
  COUNT(*) AS rows,
  COUNT(*) FILTER (WHERE e.source = 'app') AS app_rows,
  COUNT(*) FILTER (WHERE e.source = 'notion') AS notion_rows,
  string_agg(e.id::text, ', ' ORDER BY e.created_at) AS entry_ids
FROM public.cohort_lesson_log_entries e
LEFT JOIN public.cohorts c ON c.id = e.cohort_id
LEFT JOIN public.package_instances pi ON pi.id = e.package_instance_id
WHERE e.dismissed_at IS NULL
GROUP BY
  COALESCE(e.cohort_id::text, e.package_instance_id::text, 'unlinked'),
  COALESCE(c.name, pi.name, '(unlinked)'),
  e.lesson_date
HAVING COUNT(*) > 1
ORDER BY e.lesson_date DESC, target;

-- 4. Title date and lesson_date disagree (suspected timezone shift).
SELECT
  COALESCE(c.name, pi.name, '(unlinked)') AS target,
  e.lesson_date,
  e.lesson_title,
  e.source,
  e.id
FROM public.cohort_lesson_log_entries e
LEFT JOIN public.cohorts c ON c.id = e.cohort_id
LEFT JOIN public.package_instances pi ON pi.id = e.package_instance_id
WHERE e.dismissed_at IS NULL
  AND e.lesson_title ~ '\d{4}-\d{2}-\d{2}'
  AND e.lesson_title !~ e.lesson_date::text
ORDER BY e.lesson_date DESC;
