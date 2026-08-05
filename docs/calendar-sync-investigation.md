# Calendar Sync Investigation for Tutor Osh

**Date**: August 5, 2026  
**Issue**: Calendar sync not working for tutor Osh  
**Priority**: High (tutor functionality blocked)

---

## System Overview

The Kidda platform has a Google Calendar integration for tutors that:
1. Allows tutors to connect their Google Calendar via OAuth
2. Syncs calendar events to match with students/cohorts
3. Automatically syncs every 10 minutes or manually on-demand
4. Creates lesson sessions in the database for scheduling

---

## Potential Failure Points

### 1. **Tutor Role Access Issue** ⚠️ MOST LIKELY
**Symptoms**: "Tutor access required" error  
**Root Cause**: Osh may not have the `tutor` role in the `profile_roles` table

The system requires tutors to have an entry in `profile_roles` with `role = 'tutor'`. A known fix was applied in `tutor-google-calendar-fix-tutor-access.sql` to update the permission checks.

**Fix**:
```sql
-- Check if Osh has the tutor role
SELECT pr.user_id, pr.role, p.email, p.full_name
FROM profile_roles pr
JOIN profiles p ON p.id = pr.user_id
WHERE p.full_name ILIKE '%osh%' OR p.email ILIKE '%osh%';

-- If missing, add the tutor role (replace USER_ID with Osh's actual user_id)
INSERT INTO profile_roles (user_id, role)
VALUES ('USER_ID', 'tutor'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;
```

---

### 2. **Google OAuth Configuration Missing**
**Symptoms**: "Google Calendar OAuth is not configured" error  
**Required Environment Variables**:
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI` (optional, defaults to `{APP_URL}/api/google/calendar/callback`)
- `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` (optional, defaults to `SUPABASE_SERVICE_ROLE_KEY`)

**Check**: Verify these environment variables are set in production

---

### 3. **Google Calendar API Not Enabled**
**Symptoms**: "Google Calendar API has not been used" or "accessNotConfigured" error  
**Fix**: Enable the Google Calendar API in Google Cloud Console:
- Go to: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
- Select the project that contains the OAuth client
- Click "Enable"
- Wait 1-2 minutes for changes to propagate

---

### 4. **OAuth Token Issues**
**Symptoms**: Sync fails after initial connection, "token refresh failed" errors

**Possible causes**:
- Refresh token was revoked by user
- OAuth consent screen approval was revoked
- Token expired and refresh failed

**Database Check**:
```sql
-- Check Osh's calendar connection status
SELECT 
  tgcc.*,
  p.email,
  p.full_name
FROM tutor_google_calendar_connections tgcc
JOIN profiles p ON p.id = tgcc.tutor_id
WHERE p.full_name ILIKE '%osh%' OR p.email ILIKE '%osh%';
```

**Fix**: Disconnect and reconnect calendar (generates new tokens)

---

### 5. **Missing Calendar Scopes**
**Required OAuth Scopes**:
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

**Check**: Verify OAuth consent screen includes both scopes

---

### 6. **Service Role Client Not Configured**
**Symptoms**: "Service role client configuration error" during sync  
**Required**: `SUPABASE_SERVICE_ROLE_KEY` environment variable must be set

---

### 7. **Sync Token Invalidation**
**Symptoms**: Sync returns 410 Gone status  
**Cause**: Google invalidated the incremental sync token (happens periodically)  
**Fix**: System auto-recovers by doing a full sync. Can also manually trigger "Full resync" button

---

## Diagnostic Steps

### Step 1: Verify Tutor Role
```sql
-- Find Osh's user account
SELECT id, email, full_name, created_at
FROM profiles
WHERE full_name ILIKE '%osh%' OR email ILIKE '%osh%';

-- Check if they have tutor role
SELECT user_id, role, granted_at
FROM profile_roles
WHERE user_id = 'OSH_USER_ID';
```

### Step 2: Check Calendar Connection
```sql
-- Check connection status
SELECT 
  tutor_id,
  google_account_email,
  calendar_id,
  connected_at,
  last_synced_at,
  token_expires_at,
  CASE 
    WHEN token_expires_at > NOW() THEN 'Valid'
    ELSE 'Expired'
  END as token_status
FROM tutor_google_calendar_connections
WHERE tutor_id = 'OSH_USER_ID';
```

### Step 3: Test RPC Function
```sql
-- This should return {"connected": false} or connection details
-- If it errors with "Tutor access required", that's the issue
SELECT get_tutor_calendar_connection_status();
-- (Run as Osh's user via authenticated Supabase client)
```

### Step 4: Check Environment Variables
Verify in production environment:
- `GOOGLE_CALENDAR_CLIENT_ID` is set
- `GOOGLE_CALENDAR_CLIENT_SECRET` is set
- `SUPABASE_SERVICE_ROLE_KEY` is set

### Step 5: Review Sync Errors
Check application logs for:
- Google API error messages
- Token refresh failures
- Permission denied errors

---

## Resolution Workflow

### Quick Fix (Most Common Issue):
1. Find Osh's user_id from profiles table
2. Add tutor role to profile_roles table
3. Have Osh refresh the calendar page
4. Click "Sync calendar now"

### If OAuth Not Connected:
1. Verify environment variables are set
2. Have Osh click "Connect Google Calendar"
3. Complete OAuth flow
4. Should auto-sync after connection

### If Tokens Are Expired/Invalid:
1. Have Osh click "Disconnect" on calendar page
2. Then click "Connect Google Calendar" again
3. Complete OAuth flow with fresh tokens

### If Google API Not Enabled:
1. Admin enables Calendar API in Google Cloud Console
2. Wait 1-2 minutes
3. Have Osh try sync again

---

## Code Locations

- **Main sync logic**: `src/lib/calendar/sync-tutor-calendar.ts`
- **OAuth flow**: `src/lib/calendar/google-oauth.ts`
- **API endpoint**: `src/app/api/google/calendar/sync/route.ts`
- **UI components**: `src/components/tutor/tutor-calendar-*.tsx`
- **Database schema**: `supabase/tutor-google-calendar.sql`
- **Access fix**: `supabase/tutor-google-calendar-fix-tutor-access.sql`

---

## Next Steps

Run the diagnostic script (see `scripts/diagnose-calendar-sync.ts`) to automatically check:
1. Osh's tutor role status
2. Calendar connection status
3. Token validity
4. Recent sync attempts

Based on the results, apply the appropriate fix from the resolution workflow above.
