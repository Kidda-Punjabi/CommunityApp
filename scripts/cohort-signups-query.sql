-- Check cohort sign-ups for a specific date and identify issues
-- Replace '2026-08-05' with your target date (yesterday)

WITH target_signups AS (
  SELECT 
    sp.id as student_package_id,
    sp.user_id,
    sp.status,
    sp.purchased_at,
    sp.enrollment_id,
    p.name as package_name,
    c.name as course_name
  FROM student_packages sp
  LEFT JOIN packages p ON sp.package_id = p.id
  LEFT JOIN courses c ON sp.course_id = c.id
  WHERE 
    sp.purchased_at >= '2026-08-05T00:00:00'
    AND sp.purchased_at <= '2026-08-05T23:59:59'
    AND p.delivery_mode = 'group'
    AND p.includes_live_sessions = true
),
user_profiles AS (
  SELECT 
    ts.*,
    prof.full_name,
    prof.preferred_name,
    prof.avatar_url,
    prof.placement_completed_at,
    prof.learner_level
  FROM target_signups ts
  LEFT JOIN profiles prof ON ts.user_id = prof.id
),
enrollments_info AS (
  SELECT 
    up.*,
    ce.cohort_id,
    coh.name as cohort_name
  FROM user_profiles up
  LEFT JOIN course_enrollments ce ON up.enrollment_id = ce.id
  LEFT JOIN cohorts coh ON ce.cohort_id = coh.id
),
checklist_info AS (
  SELECT 
    ei.*,
    oc.time_assigned,
    oc.welcome_email,
    oc.calendar_invite,
    oc.tutor_notified,
    oc.package_created,
    oc.whatsapp_chat_made,
    oc.schedule_whatsapp_chat,
    oc.onboarding_completed
  FROM enrollments_info ei
  LEFT JOIN onboarding_checklists oc ON ei.student_package_id = oc.student_package_id
),
practice_check AS (
  SELECT DISTINCT user_id 
  FROM (
    SELECT user_id FROM game_scores
    UNION
    SELECT user_id FROM quiz_progress
    UNION
    SELECT user_id FROM topic_mastery WHERE mastery_level > 0 OR depth > 0
  ) all_practice
)
SELECT 
  ci.full_name,
  ci.preferred_name,
  ci.package_name,
  ci.course_name,
  ci.cohort_name,
  ci.purchased_at,
  ci.status,
  -- App onboarding checks
  CASE WHEN ci.full_name IS NOT NULL THEN '✅' ELSE '❌' END as has_profile,
  CASE WHEN ci.placement_completed_at IS NOT NULL THEN '✅' ELSE '⚠️' END as placement_done,
  CASE WHEN pc.user_id IS NOT NULL THEN '✅' ELSE '⚠️' END as has_practiced,
  -- Package onboarding checks
  CASE WHEN ci.cohort_id IS NOT NULL THEN '✅' ELSE '⚠️' END as cohort_assigned,
  CASE WHEN ci.time_assigned THEN '✅' ELSE '⚠️' END as time_assigned,
  CASE WHEN ci.welcome_email THEN '✅' ELSE '⚠️' END as welcome_email,
  CASE WHEN ci.calendar_invite THEN '✅' ELSE '⚠️' END as calendar_invite,
  CASE WHEN ci.tutor_notified THEN '✅' ELSE '⚠️' END as tutor_notified,
  -- Issues summary
  CONCAT_WS(', ',
    CASE WHEN ci.full_name IS NULL THEN 'No profile' END,
    CASE WHEN ci.placement_completed_at IS NULL THEN 'No placement test' END,
    CASE WHEN pc.user_id IS NULL THEN 'No practice' END,
    CASE WHEN ci.cohort_id IS NULL THEN 'No cohort' END,
    CASE WHEN NOT ci.welcome_email THEN 'No welcome email' END,
    CASE WHEN NOT ci.calendar_invite THEN 'No calendar' END
  ) as issues
FROM checklist_info ci
LEFT JOIN practice_check pc ON ci.user_id = pc.user_id
ORDER BY ci.purchased_at DESC;
