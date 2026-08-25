# Stripe Webhook Grant Tracking — Implementation Summary

## What Was Built

A comprehensive retry and surfacing mechanism for unmatched Stripe webhook events that prevents silent access grant failures like the Bradley Bains (Cohort 40) and Arjun Dhillon (Cohort 42) cases.

## Problem Solved

**Root cause:** "Payment before signup" pattern where:
1. User pays via Stripe → webhook processes payment
2. User hasn't signed up yet, or Notion lead has no `App User ID`
3. Grant fails silently — no visibility until complaint

**Real impact:**
- Bradley Bains: ALL four records missing
- 3/6 Cohort 40 students: `profile_course_access` missing
- Arjun Dhillon: Notion lead missing App User ID → complete grant failure

## Solution Components

### 1. Database Schema (supabase/stripe-webhook-grant-tracking.sql)

Added to `stripe_webhook_events` table:
```sql
grant_status TEXT NOT NULL DEFAULT 'not_applicable'
  -- Values: not_applicable, pending, completed, failed, needs_retry

grant_attempted_at TIMESTAMPTZ
grant_completed_at TIMESTAMPTZ
grant_error TEXT
grant_profile_id UUID REFERENCES profiles (id)
grant_email TEXT
grant_retry_count INTEGER NOT NULL DEFAULT 0
grant_last_retry_at TIMESTAMPTZ
```

Plus:
- 3 indexes for efficient querying
- RPC function `increment_webhook_grant_retry` for atomic retry counting

### 2. Core Tracking Logic

**Webhook processing** (`src/lib/stripe/webhook-event-log.ts`):
- `logStripeWebhookReceived()` — Determines grant_status on receipt
- `logStripeWebhookGrantAttempt()` — Updates status after grant attempt
- `logStripeWebhookGrantRetry()` — Tracks retry attempts

**Verification** (`src/lib/stripe/verify-webhook-grant.ts`):
- `verifyWebhookGrantCompletion()` — Checks all 4 downstream records exist
- `findUnmatchedWebhookGrants()` — Finds pending/failed events
- Ground truth: queries actual DB records, not just logs

**Retry mechanism** (`src/lib/stripe/retry-webhook-grants.ts`):
- `retryWebhookGrants()` — Manual/scheduled retry of all unmatched
- `retryWebhookGrantsForProfile()` — Automatic retry on signup

**Integration points**:
- `src/lib/stripe/sync-membership.ts` — Logs grants during webhook processing
- `src/lib/notion/lead-purchase-access-grant.ts` — Triggers retry on signup

### 3. Admin UI

**New page** (`/admin/webhook-grants`):
- Lists all pending/failed webhook events
- Shows verification status (which of 4 records exist)
- Email, retry count, last retry time
- Bulk "Retry All" button
- Individual retry buttons

**Attention banner** (admin home):
- Shows count of unmatched webhooks
- Links to dedicated page
- Urgent flag if >5 unmatched

**Files**:
- `src/app/admin/webhook-grants/page.tsx`
- `src/app/admin/webhook-grants/actions.ts`
- `src/components/admin/webhook-grants/admin-webhook-grants-section.tsx`
- `src/app/admin/content/home-actions.ts` (attention integration)
- `src/components/admin/admin-home-content.tsx` (navigation link)

### 4. Documentation

- `docs/webhook-grant-tracking.md` — Complete system documentation
- `DEPLOYMENT_VERIFICATION.md` — Step-by-step deployment guide
- `scripts/verify-webhook-grant-tracking.sql` — Production verification queries
- This file — Implementation summary

## How It Works

### On Payment (Webhook)

1. Stripe sends `checkout.session.completed`
2. `logStripeWebhookReceived()` determines if course purchase
3. Sets `grant_status = 'pending'`, extracts email
4. Webhook processing attempts grant
5. `logStripeWebhookGrantAttempt()` records result

### On Signup (Automatic Retry)

1. User signs up, profile created
2. `maybeGrantAccessAfterLeadLink()` attempts grant from Notion
3. Updates webhook events for this email
4. `retryWebhookGrantsForProfile()` catches any other pending webhooks

### Manual Retry (Admin)

1. Admin visits `/admin/webhook-grants`
2. Sees all pending/failed events with verification
3. Clicks "Retry All" or individual retry
4. `retryWebhookGrants()` attempts to match email → profile → lead
5. Updates status based on result

### Verification (Ground Truth)

For each webhook, system checks actual DB records:
- `cohort_members` (group only)
- `course_enrollments` ✓ required
- `student_packages` ✓ required
- `profile_course_access` ✓ required

## Deployment Instructions

### 1. Apply Database Migration

**In Supabase SQL Editor (project: pztubczhqkzcwtkstpgi):**

Run: `supabase/stripe-webhook-grant-tracking.sql`

**Verification:**
```sql
-- Should show 8 new columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'stripe_webhook_events'
  AND column_name LIKE 'grant_%';
```

### 2. Deploy Application

Deploy normally. System is backward-compatible:
- Existing events backfilled as `'not_applicable'`
- New events auto-tracked
- No breaking changes

### 3. Verify Deployment

**Run:** `scripts/verify-webhook-grant-tracking.sql` (all queries)

**Check admin UI:**
- `/admin/content` — Should show "Stripe webhook grants" link
- `/admin/webhook-grants` — Should load without errors

## Verification Requirements (Per Task)

The task requires:
> Do not report this done from code review or local testing alone. After deploying:
> - Query `stripe_webhook_events` and the new tracking mechanism directly in production Supabase
> - Confirm the admin banner actually renders when an unmatched case exists
> - Report back with: what you built, the exact query used to detect unmatched cases, and live verification evidence

### What Was Built ✓
See "What Was Built" section above.

### Query to Detect Unmatched Cases ✓

```sql
-- Used by both admin UI and attention banner
SELECT 
  id as event_id,
  checkout_session_id,
  grant_email,
  grant_profile_id,
  grant_status,
  grant_retry_count,
  grant_last_retry_at,
  received_at,
  payload_summary
FROM stripe_webhook_events
WHERE grant_status IN ('pending', 'needs_retry', 'failed')
  AND event_type = 'checkout.session.completed'
  AND livemode = true
  AND grant_retry_count < 10
  AND received_at < NOW() - INTERVAL '5 minutes'
ORDER BY received_at ASC
LIMIT 100;
```

This query:
- Filters to course purchases only (`grant_status` excludes `'not_applicable'`)
- Finds incomplete grants (`pending`, `needs_retry`, `failed`)
- Excludes recent events (5 min grace period)
- Excludes abandoned retries (>10 attempts)
- Returns details for admin UI display

### Live Verification Evidence ⏳

**TO BE COMPLETED AFTER DEPLOYMENT**

After deploying to production, I will run:

1. **Schema verification:**
   ```sql
   -- Part 1.1 from verify-webhook-grant-tracking.sql
   ```
   Expected result: 8 columns listed

2. **Check current unmatched:**
   ```sql
   -- Part 2.2 from verify-webhook-grant-tracking.sql
   ```
   Expected result: Count of pending/failed events (hopefully 0)

3. **Admin UI check:**
   - Screenshot of `/admin/webhook-grants` page
   - Screenshot of attention banner (if unmatched exist)

4. **Verify completed events:**
   ```sql
   -- Part 3.1 from verify-webhook-grant-tracking.sql
   ```
   Expected result: All 4 record counts > 0 for completed grants

5. **Test retry mechanism:**
   - Find/create a pending event
   - Click "Retry" in admin UI
   - Verify status updated

## Pull Request

**PR #14:** https://github.com/Kidda-Punjabi/CommunityApp/pull/14

Status: Draft, awaiting review

## Next Steps

1. **Review PR** — Get feedback on implementation
2. **Deploy to production** — Apply migration + deploy app
3. **Run verification queries** — Execute `scripts/verify-webhook-grant-tracking.sql`
4. **Check admin UI** — Verify page loads and functions work
5. **Report verification results** — Provide evidence per task requirements
6. **Monitor** — Watch for new events and verify tracking works

## Future Enhancements

1. **Enable pg_cron** — Auto-retry every 10 minutes
2. **Email normalization** — Strip Gmail dots, etc.
3. **Manual linking UI** — Admin can link mismatched emails
4. **Alerts** — Slack/Discord when retry count >5
5. **Historical backfill** — Populate grant_status for old events

## Known Limitations

1. **Prospective tracking** — Historical events show `'not_applicable'`
2. **No auto-retry** — pg_cron not enabled (manual or signup-triggered only)
3. **Retry cap** — Gives up after 10 retries
4. **Email matching only** — Different signup email won't auto-match

## Files Changed

### Database (1)
- `supabase/stripe-webhook-grant-tracking.sql`

### Core Logic (5)
- `src/lib/stripe/webhook-event-log.ts`
- `src/lib/stripe/verify-webhook-grant.ts`
- `src/lib/stripe/retry-webhook-grants.ts`
- `src/lib/stripe/sync-membership.ts`
- `src/lib/notion/lead-purchase-access-grant.ts`

### Admin UI (5)
- `src/app/admin/webhook-grants/page.tsx`
- `src/app/admin/webhook-grants/actions.ts`
- `src/components/admin/webhook-grants/admin-webhook-grants-section.tsx`
- `src/app/admin/content/home-actions.ts`
- `src/components/admin/admin-home-content.tsx`

### Documentation (4)
- `docs/webhook-grant-tracking.md`
- `DEPLOYMENT_VERIFICATION.md`
- `scripts/verify-webhook-grant-tracking.sql`
- `IMPLEMENTATION_SUMMARY.md` (this file)

**Total:** 15 files changed, ~2,400 lines added

## Contact

For questions or issues during deployment:
- Check `DEPLOYMENT_VERIFICATION.md` for troubleshooting
- Review `docs/webhook-grant-tracking.md` for system details
- Check PR #14 for code review comments

---

**Status:** Implementation complete, awaiting deployment and verification.
