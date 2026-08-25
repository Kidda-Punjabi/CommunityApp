-- =============================================================================
-- Webhook Grant Tracking — Production Verification Queries
-- Run these in Supabase SQL Editor after deploying
-- =============================================================================

-- =============================================================================
-- PART 1: Schema Verification
-- =============================================================================

-- 1.1 Check that all new columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'stripe_webhook_events'
  AND column_name LIKE 'grant_%'
ORDER BY ordinal_position;

-- Expected: 8 columns
-- grant_status, grant_attempted_at, grant_completed_at, grant_error, 
-- grant_profile_id, grant_email, grant_retry_count, grant_last_retry_at


-- 1.2 Check that RPC function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'increment_webhook_grant_retry';

-- Expected: 1 row with function definition


-- 1.3 Check indexes created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes
WHERE tablename = 'stripe_webhook_events'
  AND indexname LIKE '%grant%';

-- Expected: 3 indexes
-- idx_stripe_webhook_events_grant_retry
-- idx_stripe_webhook_events_grant_profile
-- idx_stripe_webhook_events_grant_email


-- =============================================================================
-- PART 2: Data Verification
-- =============================================================================

-- 2.1 Status distribution (last 30 days)
SELECT 
  grant_status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
  AND livemode = true
  AND received_at > NOW() - INTERVAL '30 days'
GROUP BY grant_status
ORDER BY count DESC;

-- Expected after deployment:
-- 'not_applicable': Most events (historical + Premium/booking)
-- 'completed': Some events (successful course grants)
-- 'pending': Few events (payment before signup)
-- 'failed'/'needs_retry': Hopefully zero, but these are what we want to catch


-- 2.2 Find current unmatched events (what admin panel will show)
SELECT 
  id as event_id,
  LEFT(checkout_session_id, 20) as session_id,
  grant_email,
  grant_status,
  grant_retry_count,
  grant_error,
  AGE(NOW(), received_at) as age,
  payload_summary->>'checkout_key' as checkout_key,
  ROUND((payload_summary->>'amount_total')::numeric / 100, 2) as amount_gbp
FROM stripe_webhook_events
WHERE grant_status IN ('pending', 'needs_retry', 'failed')
  AND event_type = 'checkout.session.completed'
  AND livemode = true
ORDER BY 
  CASE grant_status 
    WHEN 'failed' THEN 1 
    WHEN 'needs_retry' THEN 2 
    ELSE 3 
  END,
  received_at ASC
LIMIT 20;

-- Expected: Should match what shows in /admin/webhook-grants
-- If empty: Good! No unmatched events.
-- If not empty: Admin needs to review these.


-- =============================================================================
-- PART 3: Verification Quality Check
-- =============================================================================

-- 3.1 Check events with profiles but incomplete grants
-- (These should have been caught by verification)
SELECT 
  swe.id as event_id,
  swe.grant_email,
  swe.grant_profile_id,
  swe.grant_status,
  p.notion_lead_page_id IS NOT NULL as has_notion_lead,
  (SELECT COUNT(*) FROM cohort_members WHERE user_id = swe.grant_profile_id AND left_at IS NULL) as cohort_count,
  (SELECT COUNT(*) FROM course_enrollments WHERE user_id = swe.grant_profile_id) as enrollment_count,
  (SELECT COUNT(*) FROM student_packages WHERE user_id = swe.grant_profile_id AND status = 'confirmed') as package_count,
  (SELECT COUNT(*) FROM profile_course_access WHERE profile_id = swe.grant_profile_id) as access_count
FROM stripe_webhook_events swe
LEFT JOIN profiles p ON p.id = swe.grant_profile_id
WHERE swe.grant_status = 'completed'
  AND swe.grant_profile_id IS NOT NULL
  AND swe.event_type = 'checkout.session.completed'
  AND swe.livemode = true
  AND swe.received_at > NOW() - INTERVAL '7 days'
ORDER BY swe.received_at DESC
LIMIT 10;

-- Expected: For 'completed' status, all counts should be > 0
-- enrollment_count > 0
-- package_count > 0
-- access_count > 0
-- cohort_count > 0 (only for group purchases)


-- =============================================================================
-- PART 4: Historical Case Checks (Bradley Bains, Arjun Dhillon)
-- =============================================================================

-- 4.1 Check Bradley Bains case (adjust email if different)
-- Replace with actual email if known
WITH bradley AS (
  SELECT p.id as profile_id, p.email
  FROM profiles p
  WHERE p.email ILIKE '%bradley%bains%'
     OR p.display_name ILIKE '%bradley%bains%'
  LIMIT 1
)
SELECT 
  'bradley_webhook' as check_type,
  swe.id as identifier,
  swe.grant_status,
  swe.grant_email,
  swe.received_at::date as date,
  swe.payload_summary->>'checkout_key' as checkout_key
FROM stripe_webhook_events swe
CROSS JOIN bradley
WHERE swe.grant_email = bradley.email
  AND swe.event_type = 'checkout.session.completed'

UNION ALL

SELECT 
  'bradley_access',
  'cohort_members',
  (SELECT COUNT(*) FROM cohort_members cm CROSS JOIN bradley WHERE cm.user_id = bradley.profile_id AND cm.left_at IS NULL)::TEXT,
  NULL,
  NULL,
  NULL
FROM bradley

UNION ALL

SELECT 
  'bradley_access',
  'course_enrollments',
  (SELECT COUNT(*) FROM course_enrollments ce CROSS JOIN bradley WHERE ce.user_id = bradley.profile_id)::TEXT,
  NULL,
  NULL,
  NULL
FROM bradley

UNION ALL

SELECT 
  'bradley_access',
  'student_packages',
  (SELECT COUNT(*) FROM student_packages sp CROSS JOIN bradley WHERE sp.user_id = bradley.profile_id AND sp.status = 'confirmed')::TEXT,
  NULL,
  NULL,
  NULL
FROM bradley

UNION ALL

SELECT 
  'bradley_access',
  'profile_course_access',
  (SELECT COUNT(*) FROM profile_course_access pca CROSS JOIN bradley WHERE pca.profile_id = bradley.profile_id)::TEXT,
  NULL,
  NULL,
  NULL
FROM bradley;

-- Expected: Should show which records Bradley was missing
-- (Historical events will have grant_status = 'not_applicable' since this is prospective tracking)


-- 4.2 Check Arjun Dhillon case
WITH arjun AS (
  SELECT p.id as profile_id, p.email, p.notion_lead_page_id
  FROM profiles p
  WHERE p.email = 'arjundhillon1@hotmail.com'
  LIMIT 1
)
SELECT 
  'arjun_webhook' as check_type,
  swe.id as identifier,
  swe.grant_status,
  swe.grant_email,
  swe.received_at::date as date,
  arjun.notion_lead_page_id as app_user_id_set
FROM stripe_webhook_events swe
CROSS JOIN arjun
WHERE swe.grant_email = arjun.email
  AND swe.event_type = 'checkout.session.completed'

UNION ALL

SELECT 
  'arjun_access',
  'cohort_members',
  (SELECT COUNT(*) FROM cohort_members cm CROSS JOIN arjun WHERE cm.user_id = arjun.profile_id AND cm.left_at IS NULL)::TEXT,
  NULL,
  NULL,
  arjun.notion_lead_page_id
FROM arjun

UNION ALL

SELECT 
  'arjun_access',
  'course_enrollments',
  (SELECT COUNT(*) FROM course_enrollments ce CROSS JOIN arjun WHERE ce.user_id = arjun.profile_id)::TEXT,
  NULL,
  NULL,
  arjun.notion_lead_page_id
FROM arjun

UNION ALL

SELECT 
  'arjun_access',
  'student_packages',
  (SELECT COUNT(*) FROM student_packages sp CROSS JOIN arjun WHERE sp.user_id = arjun.profile_id AND sp.status = 'confirmed')::TEXT,
  NULL,
  NULL,
  arjun.notion_lead_page_id
FROM arjun

UNION ALL

SELECT 
  'arjun_access',
  'profile_course_access',
  (SELECT COUNT(*) FROM profile_course_access pca CROSS JOIN arjun WHERE pca.profile_id = arjun.profile_id)::TEXT,
  NULL,
  NULL,
  arjun.notion_lead_page_id
FROM arjun;

-- Expected: Should confirm Arjun now has all 4 records (manually fixed)
-- notion_lead_page_id should be populated


-- =============================================================================
-- PART 5: Retry Mechanism Check
-- =============================================================================

-- 5.1 Check retry counts distribution
SELECT 
  grant_retry_count,
  COUNT(*) as event_count
FROM stripe_webhook_events
WHERE grant_status IN ('pending', 'needs_retry', 'failed')
  AND event_type = 'checkout.session.completed'
  AND livemode = true
GROUP BY grant_retry_count
ORDER BY grant_retry_count;

-- Expected: Most should have low retry counts (0-2)
-- If many events have high retry counts (>5), investigate why retry isn't working


-- 5.2 Check recent retries (last 24 hours)
SELECT 
  id as event_id,
  grant_email,
  grant_status,
  grant_retry_count,
  grant_last_retry_at,
  AGE(NOW(), grant_last_retry_at) as time_since_retry
FROM stripe_webhook_events
WHERE grant_last_retry_at > NOW() - INTERVAL '24 hours'
  AND event_type = 'checkout.session.completed'
  AND livemode = true
ORDER BY grant_last_retry_at DESC
LIMIT 20;

-- Expected: Should show recent retry activity
-- If empty and you have pending events: Retry mechanism may not be triggered


-- =============================================================================
-- PART 6: Summary Dashboard
-- =============================================================================

-- 6.1 Overall health dashboard
SELECT 
  'Total events (30d)' as metric,
  COUNT(*)::TEXT as value
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
  AND livemode = true
  AND received_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Course purchases (30d)',
  COUNT(*)::TEXT
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
  AND livemode = true
  AND received_at > NOW() - INTERVAL '30 days'
  AND grant_status != 'not_applicable'

UNION ALL

SELECT 
  'Completed successfully',
  COUNT(*)::TEXT
FROM stripe_webhook_events
WHERE grant_status = 'completed'
  AND livemode = true
  AND received_at > NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Currently pending',
  COUNT(*)::TEXT
FROM stripe_webhook_events
WHERE grant_status = 'pending'
  AND livemode = true

UNION ALL

SELECT 
  'Needs retry',
  COUNT(*)::TEXT
FROM stripe_webhook_events
WHERE grant_status = 'needs_retry'
  AND livemode = true

UNION ALL

SELECT 
  'Failed',
  COUNT(*)::TEXT
FROM stripe_webhook_events
WHERE grant_status = 'failed'
  AND livemode = true

UNION ALL

SELECT 
  'Success rate',
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE grant_status = 'completed') / 
    NULLIF(COUNT(*) FILTER (WHERE grant_status != 'not_applicable'), 0),
    2
  )::TEXT || '%'
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
  AND livemode = true
  AND received_at > NOW() - INTERVAL '30 days';

-- Expected: High success rate (>95%)
-- Low pending/failed counts
-- If success rate is low, investigate grant logic


-- =============================================================================
-- VERIFICATION COMPLETE
-- =============================================================================
-- 
-- Next steps:
-- 1. Check admin UI at /admin/webhook-grants
-- 2. Check admin home attention banner at /admin/content
-- 3. Test retry mechanism for any pending events
-- 4. Monitor logs for webhook processing
-- 
-- Report verification results:
-- - Schema applied: [YES/NO]
-- - Tracking working: [YES/NO]
-- - Admin UI accessible: [YES/NO]
-- - Unmatched events count: [NUMBER]
-- =============================================================================
