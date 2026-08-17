# Stripe Webhook Grant Tracking System

## Problem

This system solves a critical production issue where Stripe payments succeed but don't result in complete access grants. This has affected real students:

- **Bradley Bains** (Cohort 40) — missed ALL four onboarding records
- **3 of 6 students in Cohort 40** — missing `profile_course_access` only
- **Arjun Dhillon** (Cohort 42) — Notion lead missing `App User ID`, so grant failed silently

The root cause: **"payment before signup"** pattern:
1. User pays via Stripe → webhook processes payment successfully
2. User hasn't signed up yet, or Notion lead has no `App User ID`
3. Grant fails silently — no visibility until student/tutor complains

## Solution Overview

The system tracks webhook-triggered access grants and provides:
1. **Status tracking** on each `stripe_webhook_events` row
2. **Automatic retry** when user signs up or lead is updated
3. **Manual retry** via admin panel
4. **Admin visibility** via attention banner and dedicated page

## Database Schema

### New columns on `stripe_webhook_events`

```sql
-- Grant tracking columns (see supabase/stripe-webhook-grant-tracking.sql)
grant_status TEXT NOT NULL DEFAULT 'not_applicable'
  -- not_applicable: Non-course payment (Premium, booking credit)
  -- pending: Payment succeeded, awaiting profile match/signup
  -- completed: All 4 access records created successfully
  -- failed: Grant attempted but errored
  -- needs_retry: Incomplete grant (e.g. missing App User ID)

grant_attempted_at TIMESTAMPTZ
grant_completed_at TIMESTAMPTZ
grant_error TEXT
grant_profile_id UUID REFERENCES profiles (id)
grant_email TEXT
grant_retry_count INTEGER NOT NULL DEFAULT 0
grant_last_retry_at TIMESTAMPTZ
```

### Four downstream records verified

The system checks that all four access records exist:
1. `cohort_members` (for group purchases)
2. `course_enrollments` ✓ required
3. `student_packages` ✓ required
4. `profile_course_access` ✓ required

## How It Works

### 1. Webhook Processing (Initial)

When Stripe sends `checkout.session.completed`:

```typescript
// src/lib/stripe/webhook-event-log.ts
logStripeWebhookReceived(event)
  → Determines if this is a course purchase
  → Sets grant_status = 'pending' if yes
  → Extracts email for later matching
```

### 2. Grant Attempt (During Webhook or Signup)

When attempting to grant access:

```typescript
// src/lib/stripe/sync-membership.ts
syncMembershipFromCheckoutSession(sessionId)
  → Tries to match email to profile
  → If no profile: logs status='pending' (payment before signup)
  → If profile found: attempts grant
  → Logs grant_status based on result

// src/lib/notion/lead-purchase-access-grant.ts
maybeGrantAccessAfterLeadLink(profileId, leadPageId)
  → Called during signup/auth callback
  → Attempts grant from Notion packages
  → Updates webhook events for this email/profile
  → Triggers retryWebhookGrantsForProfile()
```

### 3. Verification

The system verifies completion by checking actual DB records:

```typescript
// src/lib/stripe/verify-webhook-grant.ts
verifyWebhookGrantCompletion(profileId, options)
  → Queries all 4 downstream tables
  → Returns which records exist/missing
  → This is the ground truth, not just logs
```

### 4. Retry Mechanism

**Automatic retry** (triggered on signup):
```typescript
// src/lib/stripe/retry-webhook-grants.ts
retryWebhookGrantsForProfile(profileId, email)
  → Finds pending webhooks for this email
  → Attempts grant from linked Notion lead
  → Updates webhook status
```

**Manual retry** (admin action):
```typescript
retryWebhookGrants(options)
  → Finds all pending/failed events older than X minutes
  → For each: tries to match email → profile → lead
  → Attempts grant if profile+lead found
  → Updates status: completed/needs_retry/failed
```

### 5. Admin Visibility

**Admin home attention banner:**
- Shows count of unmatched webhooks
- Links to `/admin/webhook-grants`
- Urgent flag if >5 unmatched

**Dedicated admin page** (`/admin/webhook-grants`):
- Lists all pending/failed webhook events
- Shows verification status (which of 4 records exist)
- Retry all button
- Retry individual event button
- Displays email, retry count, last retry time

## Usage

### For Admins

1. **Check attention banner** on admin home
   - Shows if any payments need attention
   - Click to go to webhook grants page

2. **Webhook grants page** (`/admin/webhook-grants`)
   - See all unmatched payments
   - Retry All → attempts to match all pending
   - Retry individual → attempts specific event
   - Verification shows which records are missing

3. **When to investigate manually:**
   - Retry count > 5 and still pending
   - User claims they paid but have no access
   - Verification shows incomplete grant

### For Developers

**When adding new payment flows:**

1. **During webhook processing**, call:
   ```typescript
   await logStripeWebhookGrantAttempt({
     sessionId: session.id,
     profileId: userId,
     email: session.customer_details?.email,
     status: "completed" | "pending" | "failed",
     error: errorMessage,
   });
   ```

2. **During signup/grant**, call:
   ```typescript
   await retryWebhookGrantsForProfile(profileId, email);
   ```

3. **Add verification** for new access types if needed:
   ```typescript
   // In verify-webhook-grant.ts
   verifyWebhookGrantCompletion()
     → Add new table checks
   ```

## Queries for Production Verification

### Check tracking status distribution
```sql
SELECT grant_status, COUNT(*)
FROM stripe_webhook_events
WHERE event_type = 'checkout.session.completed'
  AND livemode = true
  AND received_at > now() - interval '30 days'
GROUP BY grant_status
ORDER BY grant_status;
```

### Find unmatched events
```sql
SELECT 
  id, 
  grant_email, 
  grant_status, 
  grant_retry_count,
  grant_error,
  received_at,
  payload_summary->>'checkout_key' as checkout_key,
  payload_summary->>'amount_total' as amount_total
FROM stripe_webhook_events
WHERE grant_status IN ('pending', 'needs_retry', 'failed')
  AND event_type = 'checkout.session.completed'
  AND livemode = true
ORDER BY received_at DESC
LIMIT 50;
```

### Verify specific student
```sql
-- Check webhook event
SELECT 
  grant_status, grant_error, grant_retry_count, received_at
FROM stripe_webhook_events
WHERE grant_email = 'student@example.com'
  AND event_type = 'checkout.session.completed'
ORDER BY received_at DESC
LIMIT 5;

-- Check actual access records
SELECT 'cohort_members' as table_name, COUNT(*) as count
FROM cohort_members WHERE user_id = '<profile_id>' AND left_at IS NULL
UNION ALL
SELECT 'course_enrollments', COUNT(*) FROM course_enrollments WHERE user_id = '<profile_id>'
UNION ALL
SELECT 'student_packages', COUNT(*) FROM student_packages WHERE user_id = '<profile_id>' AND status = 'confirmed'
UNION ALL
SELECT 'profile_course_access', COUNT(*) FROM profile_course_access WHERE profile_id = '<profile_id>';
```

### Check Bradley Bains / Arjun Dhillon cases historically

Since the tracking is prospective (starts after deployment), historical cases like Bradley and Arjun won't have `grant_status` fields populated. To check similar cases:

```sql
-- Find checkout sessions from Cohort 42 that might have grant issues
SELECT 
  swe.id,
  swe.checkout_session_id,
  swe.payload_summary->>'email' as email,
  swe.received_at,
  p.id as profile_id,
  p.notion_lead_page_id,
  (SELECT COUNT(*) FROM cohort_members WHERE user_id = p.id AND left_at IS NULL) as cohort_member_count,
  (SELECT COUNT(*) FROM course_enrollments WHERE user_id = p.id) as enrollment_count,
  (SELECT COUNT(*) FROM student_packages WHERE user_id = p.id AND status = 'confirmed') as package_count,
  (SELECT COUNT(*) FROM profile_course_access WHERE profile_id = p.id) as access_count
FROM stripe_webhook_events swe
LEFT JOIN profiles p ON p.email = swe.payload_summary->>'email'
WHERE swe.event_type = 'checkout.session.completed'
  AND swe.payload_summary->>'checkout_key' LIKE '%cohort%'
  AND swe.received_at > '2024-01-01'
ORDER BY swe.received_at DESC;
```

## Known Limitations

1. **Tracking is prospective** — historical events before deployment won't have `grant_status`
2. **No automatic cron** — pg_cron not enabled, so retry is manual or triggered by signup
3. **Retry cap** — gives up after 10 retries (configurable)
4. **Email matching only** — if user signs up with different email than payment, won't auto-match

## Future Improvements

1. **Enable pg_cron** for scheduled retry (every 10 minutes)
2. **Email normalization** (strip dots from Gmail, etc.)
3. **Manual profile linking** in admin UI when email doesn't match
4. **Webhook alerts** (Slack/Discord) when retry count > threshold
5. **Backfill historical events** with grant_status based on current DB state
