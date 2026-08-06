# Cohort Sign-Up Analysis

This directory contains tools to analyze cohort sign-ups and identify onboarding issues.

## Quick Access via Admin Dashboard

The easiest way to check yesterday's cohort sign-ups is through the admin interface:

### 1. App Onboarding Dashboard
**URL:** `/admin/app-onboarding`

Shows all app sign-ups with milestone tracking:
- ✅ Account created
- ✅/⚠️ Email confirmed
- ✅/⚠️ Profile filled (name + preferred name/avatar)
- ✅/⚠️ Placement test completed
- ✅/⚠️ Practice activity recorded

### 2. Package Onboarding Dashboard
**URL:** `/admin/onboarding`

Shows cohort/package purchases with onboarding checklist:
- ⚠️ Time assigned
- ⚠️ Welcome email sent
- ⚠️ Calendar invite sent
- ⚠️ Tutor notified
- ⚠️ Package created
- ⚠️ WhatsApp chat created
- ⚠️ WhatsApp chat scheduled
- ⚠️ Onboarding marked complete

## Common Issues to Look For

### App-Level Issues
1. **Email Not Confirmed**: User hasn't clicked the confirmation link in their signup email
2. **Profile Incomplete**: User hasn't filled in their name and preferred name/avatar
3. **Placement Test Not Done**: User hasn't completed the initial level assessment
4. **No Practice Activity**: User hasn't engaged with any learning content (games, quizzes, topics)

### Package/Cohort-Level Issues
1. **Not Assigned to Cohort**: User purchased but hasn't been assigned to a cohort yet
2. **Welcome Email Not Sent**: Automated or manual welcome email pending
3. **Calendar Invite Not Sent**: User hasn't received calendar invite for cohort sessions
4. **Tutor Not Notified**: Tutor hasn't been informed about new student
5. **WhatsApp Setup Incomplete**: WhatsApp group chat not created or user not invited

## Automated Script

Run `npx tsx scripts/check-cohort-signups.ts [YYYY-MM-DD]` to generate a detailed report.

**Requirements:**
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Or set those environment variables

**Output includes:**
- Full name and email for each sign-up
- Package and course details
- Timestamp and payment status
- Cohort assignment status
- Detailed milestone checklist with ✅/⚠️ indicators
- Summary of issues found

**Default behavior:** If no date is provided, checks yesterday's sign-ups.

## Direct SQL Query

Run `scripts/cohort-signups-query.sql` in your Supabase SQL editor to get a tabular view of all sign-ups with issue flags.

Remember to update the date filter in the query:
```sql
sp.purchased_at >= '2026-08-05T00:00:00'
AND sp.purchased_at <= '2026-08-05T23:59:59'
```

## Data Model

### Student Sign-Up Flow
1. User creates account (`auth.users`)
2. User confirms email (`email_confirmed_at`)
3. User creates profile (`profiles`)
4. User completes placement test (`placement_completed_at`)
5. User purchases package (`student_packages.purchased_at`)
6. User assigned to cohort (`course_enrollments` → `cohorts`)
7. Admin completes onboarding checklist (`onboarding_checklists`)

### Key Tables
- `auth.users`: Authentication data
- `profiles`: User profile information
- `student_packages`: Package purchases
- `packages`: Package definitions
- `courses`: Course definitions
- `course_enrollments`: Links users to cohorts
- `cohorts`: Group cohort information
- `onboarding_checklists`: Package onboarding progress
- `game_scores`, `quiz_progress`, `topic_mastery`: Practice activity tracking
