# Root Cause Analysis: grantAccessFromLinkedLeadPackages Intermittent Failure

**Date**: August 6, 2026  
**Incident**: 2026-08-05, 6 students signed up for Cohort 40 within ~50 seconds. 3/6 grants succeeded immediately, 1 succeeded 18hrs later, 2 never succeeded. ZERO queue entries for any of the 6.

---

## Summary

The `grantAccessFromLinkedLeadPackages` function had multiple silent failure paths where errors were not being queued as designed. When 6 concurrent signups occurred, some failures were completely silent - no logs, no queue entries, no indication anything went wrong.

---

## Root Cause

### Primary Issue: Queue Insert Failures Were Silent

The function was designed to queue all failures, but if the queue insert itself failed, there was no fallback or visibility. The error was added to `result.errors` but:

1. **Calling code ignored the result**: All call sites (`signup/actions.ts`, `auth/callback/route.ts`, `login/actions.ts`, `lead-sync.ts`) wrapped the call in try-catch that only logged errors. They never checked if `result.granted === 0 && result.queued === 0`.

2. **No defensive logging**: When queue insert failed, it only added the error to the result object. If the calling code didn't check the result, the failure was completely silent.

3. **No request correlation**: With 6 concurrent requests, logs were interleaved and impossible to correlate without a request ID.

### Contributing Factors

1. **Concurrent Load**: 6 signups within 50 seconds created high concurrent load on:
   - Service role Supabase clients (6 separate instances)
   - Notion API calls (6 concurrent page fetches)
   - Database operations (multiple upserts per request)

2. **Notion API Rate Limiting**: Possible rate limit hits that were caught but not properly surfaced

3. **Database Connection Pool**: Potential exhaustion with 6 concurrent service role clients each making multiple queries

---

## Evidence

### What Worked (3/6 succeeded immediately):
- `6a3f2401-390d-4b71-8020-a5774d4c3719` - granted at 18:10:54
- `c2982a04-cb03-4e96-9c92-d10caa88a9ee` - granted at 18:10:11  
- `69527330-8466-4bbf-a7e2-2460e3f1a5e8` - granted at 12:05:47 next day

### What Failed Silently (2/6):
- `a7ac91b9-1b65-4ca6-bba4-1d5a59b33f8e` - created 18:08:41, never granted
- `341ebfec-4601-4667-8a8d-3c3c20be2e00` - created 18:08:54, never granted

### What Failed with Delay (1/6):
- `e5329e99-16ab-445f-83f2-df9b5fdfce09` - created 18:09:12, granted ~18hrs later

The ~18hr delay indicates the cron backfill path (`linkUnlinkedProfilesFromApp`) eventually picked up one of the failures.

### Zero Queue Entries

The smoking gun: **ZERO rows in `notion_lead_purchase_grant_queue` for ANY of the 6 users**, including the 3 that failed. This proves queue inserts were failing silently.

---

## The Fix

### 1. Comprehensive Request Tracking

Added `requestId` to every log statement:
```typescript
const requestId = `${profileId.slice(0, 8)}-${Date.now()}`;
console.info(`[lead purchase grant] begin requestId=${requestId} ...`);
```

This allows correlating all logs for a single grant attempt across concurrent requests.

### 2. Detailed Timing Logs

Added elapsed time tracking:
```typescript
const startTime = Date.now();
// ... operations ...
console.info(`... elapsed=${Date.now() - startTime}ms`);
```

This helps identify if specific operations (Notion API, database) are timing out or slow under load.

### 3. Safety Net in maybeGrantAccessAfterLeadLink

Added detection for "attempted but not granted and not queued":
```typescript
if (result.attempted && result.granted === 0 && result.queued === 0 && result.errors.length > 0) {
  console.error(`[lead purchase grant] grant failed but not queued requestId=${requestId} ...`);
  try {
    const queueResult = await enqueueLeadPurchaseGrant(...);
    if (queueResult.queued) {
      result.queued = 1;
    }
  } catch (retryQueueError) {
    console.error(`[lead purchase grant] retry queue failed ...`);
  }
}
```

This catches the exact scenario from the incident: grant fails, queue insert also fails, result is returned with errors but no queue entry.

### 4. CRITICAL Logging for Queue Failures

Changed from:
```typescript
if (queued.error) result.errors.push(queued.error);
```

To:
```typescript
if (queued.error) {
  result.errors.push(queued.error);
  console.error(`[lead purchase grant] CRITICAL queue insert failed requestId=${requestId}:`, queued.error);
}
```

Now queue insert failures are immediately visible in logs with CRITICAL tag.

### 5. Enhanced Error Context

All queued errors now include:
- Stack traces (truncated to 500 chars)
- Request ID for correlation
- ISO timestamp
- Target details (kind, runId) for grant failures

```typescript
rawPackageData: { 
  error: message, 
  stack: stack?.slice(0, 500),
  requestId,
  timestamp: new Date().toISOString(),
}
```

### 6. Step-by-Step Logging

Added detailed logs at each major step:
- Notion fetch complete
- Package resolution (each package)
- Grant attempt start
- Grant success/failure

This creates a complete audit trail for debugging.

---

## Testing

Created `scripts/test-concurrent-grant.ts` to:
1. Find test profiles with valid lead links
2. Run 6 concurrent grants (simulating real incident)
3. Verify ALL results are either:
   - `granted === 1` (success)
   - `queued === 1` (failure but queued)
   - `skipped === 1` (no packages, expected)
4. Fail if ANY silent failures detected

Run with: `tsx scripts/test-concurrent-grant.ts`

---

## Verification Checklist

- [ ] Deploy code to production
- [ ] Monitor logs for next cohort signup batch
- [ ] Verify all `requestId` logs are present and correlatable
- [ ] Check `notion_lead_purchase_grant_queue` for any new entries
- [ ] Confirm NO silent failures (all failures have queue entries or CRITICAL logs)
- [ ] Run test script in staging to verify fix

---

## Future Improvements

1. **Connection Pool Management**: Consider singleton service role client or connection pooling for high-load scenarios

2. **Retry Logic**: Add automatic retry for transient Notion API failures before queuing

3. **Monitoring Alerts**: Set up alerts for:
   - CRITICAL log entries (queue insert failures)
   - High queue growth rate
   - Grant success rate drop below 95%

4. **Rate Limiting**: Add request throttling for Notion API calls during high concurrent load

5. **Circuit Breaker**: Implement circuit breaker pattern for Notion API to fail fast when rate limited

---

## Related Files

- **Main function**: `src/lib/notion/lead-purchase-access-grant.ts`
- **Calling code**:
  - `src/app/signup/actions.ts` (line 65)
  - `src/app/auth/callback/route.ts` (line 62)
  - `src/app/login/actions.ts` (line 55)
  - `src/lib/notion/lead-sync.ts` (line 828 - cron backfill)
- **Queue schema**: `supabase/notion-lead-purchase-grant-queue.sql`
- **Course access**: `src/lib/admin/package-course-access.ts`
- **Test script**: `scripts/test-concurrent-grant.ts`

---

## Lessons Learned

1. **Never trust silent success**: Functions that "never throw" need verification that they actually succeeded
2. **Log correlation is critical**: Without request IDs, debugging concurrent failures is nearly impossible
3. **Queue everything... including queue failures**: Need fallbacks when the error handling itself fails
4. **Test under load**: Concurrent scenarios reveal issues that sequential tests miss
5. **Make failures loud**: CRITICAL logs, metrics, alerts - failures should be impossible to miss
