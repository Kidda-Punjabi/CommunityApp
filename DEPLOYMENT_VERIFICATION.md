# Webhook Grant Tracking — Production Deployment & Verification

## Pre-Deployment Checklist

### 1. Apply Database Migration
Run this SQL in Supabase SQL Editor (project: pztubczhqkzcwtkstpgi):

```bash
# File: supabase/stripe-webhook-grant-tracking.sql
```

**Verify schema applied:**
```sql
-- Should show the new columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'stripe_webhook_events'
  AND column_name LIKE 'grant_%'
ORDER BY ordinal_position;

-- Should return 8 columns: grant_status, grant_attempted_at, grant_completed_at,
-- grant_error, grant_profile_id, grant_email, grant_retry_count, grant_last_retry_at
```

### 2. Deploy Application Code
Deploy the application with the new code. The system is backward-compatible:
- Existing webhook events will have `grant_status = 'not_applicable'` (backfilled)
- New webhook events will start tracking automatically
- No data loss or breaking changes

### 3. Verify Admin UI Access
After deployment, test admin panel access:

1. **Go to admin home**: `/admin/content`
   - Should see "Stripe webhook grants" in sections list

2. **Go to webhook grants page**: `/admin/webhook-grants`
   - Should load without errors (may show "No unmatched webhook grants" if none exist yet)

## Post-Deployment Verification

### Step 1: Verify Schema in Production

```sql
-- Check that backfill completed (all existing events should be 'not_applicable')
SELECT 
  grant_status,
  COUNT(*) as count
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
GROUP BY grant_status
ORDER BY grant_status;
```

Expected result:
- `not_applicable`: [large number] (all historical events)
- Other statuses will start appearing for new events

### Step 2: Monitor New Webhook Events

After deployment, watch for new checkout sessions:

```sql
-- Check new events are being tracked
SELECT 
  id,
  checkout_session_id,
  grant_status,
  grant_email,
  grant_profile_id,
  received_at,
  payload_summary->>'checkout_key' as checkout_key
FROM stripe_webhook_events
WHERE received_at > NOW() - INTERVAL '1 hour'
  AND event_type = 'checkout.session.completed'
ORDER BY received_at DESC
LIMIT 10;
```

For course purchases (not Premium/booking), `grant_status` should be:
- `pending` if email not yet matched to profile
- `completed` if grant succeeded
- `failed` if grant attempted but errored
- `needs_retry` if grant incomplete

### Step 3: Test Retry Mechanism

#### A. Create Test Case (Optional)
To test the "payment before signup" flow:

1. Find a recent webhook with `grant_status = 'pending'` (if none exist, wait for one)
2. Go to `/admin/webhook-grants`
3. Click "Retry All" or individual "Retry"
4. Check logs and database to see retry attempt

#### B. Check Automatic Retry on Signup
When a new user signs up after paying:

```sql
-- Find webhooks that transitioned from 'pending' to 'completed'
SELECT 
  id,
  grant_email,
  grant_status,
  grant_retry_count,
  grant_attempted_at,
  grant_completed_at,
  received_at
FROM stripe_webhook_events
WHERE grant_status = 'completed'
  AND grant_retry_count > 0
ORDER BY grant_completed_at DESC
LIMIT 5;
```

### Step 4: Verify Historical Cases

Check if system would have caught the known failures:

#### Bradley Bains (Cohort 40)
```sql
-- Find Bradley's payment
SELECT 
  swe.id,
  swe.checkout_session_id,
  swe.grant_status, -- Will be 'not_applicable' (historical)
  swe.payload_summary->>'email' as email,
  swe.received_at,
  p.id as profile_id,
  (SELECT COUNT(*) FROM cohort_members WHERE user_id = p.id AND cohort_id = '<cohort-40-id>' AND left_at IS NULL) as has_cohort_member,
  (SELECT COUNT(*) FROM course_enrollments WHERE user_id = p.id) as has_enrollment,
  (SELECT COUNT(*) FROM student_packages WHERE user_id = p.id AND status = 'confirmed') as has_package,
  (SELECT COUNT(*) FROM profile_course_access WHERE profile_id = p.id) as has_access
FROM stripe_webhook_events swe
LEFT JOIN profiles p ON p.email = swe.payload_summary->>'email'
WHERE swe.payload_summary->>'email' ILIKE '%bradley%bains%'
  -- OR use known email
  AND swe.event_type = 'checkout.session.completed'
ORDER BY swe.received_at DESC
LIMIT 5;
```

Verify the four counts to confirm the missing records issue.

#### Arjun Dhillon (Cohort 42)
```sql
-- Find Arjun's payment (arjundhillon1@hotmail.com)
SELECT 
  swe.id,
  swe.checkout_session_id,
  swe.grant_status,
  swe.payload_summary->>'email' as email,
  swe.received_at,
  p.id as profile_id,
  p.notion_lead_page_id, -- This was NULL initially
  (SELECT COUNT(*) FROM cohort_members WHERE user_id = p.id AND left_at IS NULL) as has_cohort_member,
  (SELECT COUNT(*) FROM course_enrollments WHERE user_id = p.id) as has_enrollment,
  (SELECT COUNT(*) FROM student_packages WHERE user_id = p.id AND status = 'confirmed') as has_package,
  (SELECT COUNT(*) FROM profile_course_access WHERE profile_id = p.id) as has_access
FROM stripe_webhook_events swe
LEFT JOIN profiles p ON p.email = 'arjundhillon1@hotmail.com'
WHERE swe.payload_summary->>'email' = 'arjundhillon1@hotmail.com'
  AND swe.event_type = 'checkout.session.completed'
ORDER BY swe.received_at DESC
LIMIT 5;
```

### Step 5: Check Admin Attention Banner

1. **Go to admin home** (`/admin/content`)
2. If any unmatched webhooks exist, should see attention item:
   - "X payment webhooks haven't resulted in complete access grants"
   - Click should go to `/admin/webhook-grants`

If no unmatched webhooks, attention banner won't show (this is correct behavior).

### Step 6: Verify Retry Logic End-to-End

To fully test the system, simulate a "payment before signup" scenario:

1. **Find a pending webhook** (or create test scenario)
2. **Check verification**:
   ```sql
   -- Run this query for a specific event
   SELECT 
     'cohort_members' as table_name, 
     COUNT(*) as count
   FROM cohort_members 
   WHERE user_id = '<profile_id>' 
     AND left_at IS NULL
   UNION ALL
   SELECT 'course_enrollments', COUNT(*) 
   FROM course_enrollments 
   WHERE user_id = '<profile_id>'
   UNION ALL
   SELECT 'student_packages', COUNT(*) 
   FROM student_packages 
   WHERE user_id = '<profile_id>' 
     AND status = 'confirmed'
   UNION ALL
   SELECT 'profile_course_access', COUNT(*) 
   FROM profile_course_access 
   WHERE profile_id = '<profile_id>';
   ```

3. **Trigger retry** via admin UI
4. **Verify status updated**:
   ```sql
   SELECT 
     grant_status,
     grant_retry_count,
     grant_error,
     grant_last_retry_at
   FROM stripe_webhook_events
   WHERE id = '<event_id>';
   ```

## Production Queries

### Dashboard Query: Current Status Summary

```sql
SELECT 
  CASE 
    WHEN grant_status = 'not_applicable' THEN 'Not Applicable (Premium/Booking/Historical)'
    WHEN grant_status = 'pending' THEN 'Pending (Payment before signup)'
    WHEN grant_status = 'completed' THEN 'Completed Successfully'
    WHEN grant_status = 'failed' THEN 'Failed (Needs Investigation)'
    WHEN grant_status = 'needs_retry' THEN 'Needs Retry (Incomplete Grant)'
    ELSE 'Unknown'
  END as status_category,
  COUNT(*) as event_count
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
  AND livemode = true
  AND received_at > NOW() - INTERVAL '30 days'
GROUP BY grant_status
ORDER BY 
  CASE grant_status
    WHEN 'failed' THEN 1
    WHEN 'needs_retry' THEN 2
    WHEN 'pending' THEN 3
    WHEN 'completed' THEN 4
    WHEN 'not_applicable' THEN 5
  END;
```

### Find Events Needing Attention

```sql
SELECT 
  id as event_id,
  checkout_session_id,
  grant_email,
  grant_status,
  grant_retry_count,
  grant_error,
  DATE_TRUNC('minute', AGE(NOW(), received_at)) as age,
  payload_summary->>'checkout_key' as checkout_key,
  (payload_summary->>'amount_total')::numeric / 100 as amount_gbp
FROM stripe_webhook_events
WHERE grant_status IN ('pending', 'failed', 'needs_retry')
  AND event_type = 'checkout.session.completed'
  AND livemode = true
  AND grant_retry_count < 10
ORDER BY 
  CASE grant_status 
    WHEN 'failed' THEN 1 
    WHEN 'needs_retry' THEN 2 
    ELSE 3 
  END,
  received_at ASC
LIMIT 50;
```

### Check Specific Student

```sql
-- Replace with actual email
WITH target AS (
  SELECT '<student-email>' as email
)
SELECT 
  'webhook_event' as source,
  swe.id as identifier,
  swe.grant_status as status,
  swe.grant_error as error,
  swe.received_at as timestamp
FROM stripe_webhook_events swe, target
WHERE swe.grant_email = target.email
  AND swe.event_type = 'checkout.session.completed'

UNION ALL

SELECT 
  'profile' as source,
  p.id as identifier,
  CASE WHEN p.notion_lead_page_id IS NOT NULL THEN 'linked' ELSE 'not_linked' END as status,
  p.notion_lead_page_id as error,
  p.created_at as timestamp
FROM profiles p, target
WHERE p.email = target.email

UNION ALL

SELECT 
  'cohort_member' as source,
  cm.id as identifier,
  CASE WHEN cm.left_at IS NULL THEN 'active' ELSE 'left' END as status,
  c.name as error,
  cm.joined_at as timestamp
FROM cohort_members cm
JOIN cohorts c ON c.id = cm.cohort_id
JOIN profiles p ON p.id = cm.user_id, target
WHERE p.email = target.email

ORDER BY timestamp DESC;
```

## Rollback Plan

If issues arise, the system is non-destructive and can be disabled:

1. **Disable admin UI**:
   - Remove or hide `/admin/webhook-grants` link
   - Attention banner will still work but won't cause errors

2. **Disable tracking** (if needed):
   - Set all future events to `'not_applicable'` status in code
   - Comment out `logStripeWebhookGrantAttempt()` calls

3. **Database rollback** (extreme case):
   ```sql
   -- Remove new columns (careful - loses tracking data)
   ALTER TABLE stripe_webhook_events
     DROP COLUMN IF EXISTS grant_status,
     DROP COLUMN IF EXISTS grant_attempted_at,
     DROP COLUMN IF EXISTS grant_completed_at,
     DROP COLUMN IF EXISTS grant_error,
     DROP COLUMN IF EXISTS grant_profile_id,
     DROP COLUMN IF EXISTS grant_email,
     DROP COLUMN IF EXISTS grant_retry_count,
     DROP COLUMN IF EXISTS grant_last_retry_at;
   ```

## Success Criteria

✅ Database migration applied successfully  
✅ New webhook events show appropriate `grant_status`  
✅ Admin page loads without errors  
✅ Retry mechanism successfully completes or queues grants  
✅ Attention banner shows unmatched webhooks when they exist  
✅ Verification queries show all 4 records for successful grants  
✅ System catches "payment before signup" cases  

## Monitoring

After deployment, monitor:

1. **Weekly**: Check unmatched webhook count via admin panel
2. **When student reports access issue**: Check webhook grants page first
3. **Monthly**: Review query for `grant_status` distribution
4. **On deployment**: Verify no new errors in logs related to grant tracking

## Next Steps

Once verified in production:

1. **Enable pg_cron** (if available) for automatic retry every 10 minutes
2. **Set up alerts** for webhooks with `retry_count > 5`
3. **Analyze patterns** in failed grants to improve matching logic
4. **Consider backfilling** historical events with current verification status
