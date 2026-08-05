# Calendar Sync Diagnostic and Fix Tools

Tools for diagnosing and fixing Google Calendar sync issues for tutors.

## Quick Start

### 1. Diagnose the Issue

```bash
npm run sync-tutor-calendars diagnose osh@example.com
# or
tsx scripts/diagnose-calendar-sync.ts osh@example.com
```

This will check:
- ✅ Tutor role permissions
- ✅ Google Calendar connection status
- ✅ OAuth token validity
- ✅ Recent synced sessions
- ✅ Environment configuration

### 2. Apply the Fix

Most common issue is missing tutor role. Fix it with:

```bash
tsx scripts/fix-add-tutor-role.ts osh@example.com
```

## Common Issues & Solutions

### Issue 1: "Tutor access required" Error

**Symptom**: Tutor can't access calendar sync features  
**Cause**: Missing `tutor` role in `profile_roles` table  
**Fix**: Run `scripts/fix-add-tutor-role.ts`

### Issue 2: Calendar Not Connected

**Symptom**: No calendar connection found  
**Cause**: Tutor hasn't completed OAuth flow  
**Fix**: 
1. Go to `/dashboard/tutor/calendar`
2. Click "Connect Google Calendar"
3. Complete OAuth authorization

### Issue 3: Token Expired

**Symptom**: Sync fails with authentication error  
**Cause**: OAuth token expired and refresh failed  
**Fix**:
1. Disconnect calendar (if connected)
2. Reconnect using fresh OAuth flow

### Issue 4: Google Calendar API Not Enabled

**Symptom**: "Calendar API has not been used" error  
**Cause**: Calendar API not enabled in Google Cloud project  
**Fix**:
1. Go to Google Cloud Console
2. Enable Calendar API for the OAuth project
3. Wait 1-2 minutes
4. Retry sync

### Issue 5: Missing OAuth Configuration

**Symptom**: "OAuth not configured" error  
**Cause**: Missing environment variables  
**Fix**: Set these environment variables:
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`
- `GOOGLE_CALENDAR_REDIRECT_URI` (optional)

## Manual SQL Checks

### Check if user has tutor role:

```sql
SELECT pr.role, p.email, p.full_name
FROM profile_roles pr
JOIN profiles p ON p.id = pr.user_id
WHERE p.email = 'osh@example.com';
```

### Check calendar connection:

```sql
SELECT 
  tutor_id,
  google_account_email,
  connected_at,
  last_synced_at,
  token_expires_at > NOW() as token_valid
FROM tutor_google_calendar_connections tgcc
JOIN profiles p ON p.id = tgcc.tutor_id
WHERE p.email = 'osh@example.com';
```

### Add tutor role manually:

```sql
INSERT INTO profile_roles (user_id, role)
SELECT id, 'tutor'::app_role
FROM profiles
WHERE email = 'osh@example.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Architecture Overview

### OAuth Flow
1. Tutor clicks "Connect Google Calendar"
2. Redirects to Google OAuth consent screen
3. Google redirects back to `/api/google/calendar/callback`
4. System exchanges auth code for access + refresh tokens
5. Tokens stored in `tutor_google_calendar_connections`
6. Initial sync runs automatically

### Sync Process
- **Auto-sync**: Every 10 minutes (when calendar page is open)
- **Manual sync**: Click "Sync calendar now" button
- **Full resync**: Click "Full resync" to ignore sync token

### Token Refresh
- Tokens auto-refresh when expired
- Refresh happens during sync if token expires in < 60 seconds
- If refresh fails, tutor needs to reconnect

## File Locations

- **Diagnostic script**: `scripts/diagnose-calendar-sync.ts`
- **Fix script**: `scripts/fix-add-tutor-role.ts`
- **Investigation doc**: `docs/calendar-sync-investigation.md`
- **Main sync logic**: `src/lib/calendar/sync-tutor-calendar.ts`
- **OAuth flow**: `src/lib/calendar/google-oauth.ts`
- **Database schema**: `supabase/tutor-google-calendar.sql`

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CALENDAR_CLIENT_ID`
- `GOOGLE_CALENDAR_CLIENT_SECRET`

Optional:
- `GOOGLE_CALENDAR_REDIRECT_URI` (defaults to `{APP_URL}/api/google/calendar/callback`)
- `GOOGLE_CALENDAR_OAUTH_STATE_SECRET` (defaults to `SUPABASE_SERVICE_ROLE_KEY`)
- `GOOGLE_CALENDAR_SYNC_LOOKAHEAD_DAYS` (default: 540)
- `GOOGLE_CALENDAR_SYNC_LOOKBACK_DAYS` (default: 90)
- `GOOGLE_CALENDAR_LESSON_TITLE_TAG` (optional filter for event titles)

## Support

For more details, see:
- Full investigation: `docs/calendar-sync-investigation.md`
- Database schema: `supabase/tutor-google-calendar.sql`
- Access fix SQL: `supabase/tutor-google-calendar-fix-tutor-access.sql`
