# Backlog Investigation Report
**Date**: 2026-08-06  
**Status**: Investigation in progress  
**Total Items**: 11 (9 implement + 2 report-only)

---

## Executive Summary

| # | Issue | Status | Root Cause | Fix Complexity |
|---|-------|--------|------------|----------------|
| 1 | Attendance sync false success | ✅ Found | UX: Success message ambiguous | Low |
| 3 | New cohort roster not visible | ⏸️ Pending | TBD - timing/RLS/provisioning? | TBD |
| 4 | Account identity mix-up (CRITICAL) | ⏸️ Pending DB check | Session/cache/data corruption | TBD |
| 5 | Login/account-creation friction | ⏸️ Pending | Related to #3/#4? | TBD |
| 6 | Duplicate lesson entries | ⏸️ Needs UI review | Multiple logs per lesson/date | Medium |
| 7/8 | Cancelled class logs / status | ✅ Found | UX: Cancelled logs still visible | Low |
| 10 | MCQ distractors irrelevant | ⏸️ Not started | Distractor selection logic | Medium |
| 12 | No saved confirmation | ⏸️ Not started | Toast disappears too fast | Low |
| 14 | Feedback scores lack context | ⏸️ Not started | Missing stage tag | Low |
| 9 | Inconsistent vocabulary | ⏸️ Report only | Content audit needed | N/A |
| 13 | Hours/workload allocation | ⏸️ Report only | Product decision needed | N/A |

---

## CRITICAL: #4 - Account Identity Mix-Up

### Observed Issue
**Nikhita Bhamra** logged in and saw **"Arshdeep"** as the name on her account.

### Investigation Findings

#### Display Name Logic Flow
1. **Authentication**: `supabase.auth.getUser()` returns `User` object with `user.id`
2. **Profile Load**: `loadEditableProfile(supabase, userId)` queries `profiles` table
3. **Display Name**: `getDisplayName(profile)` (`src/lib/profile/display-name.ts:7-18`)
   - Returns `preferred_name` if set, OR
   - First word of `full_name`, OR
   - `null`

#### Home Page Data Flow
**File**: `src/lib/dashboard/home-data.ts:292-376`
```typescript
const userId = user.id;
const profile = await loadEditableProfile(supabase, userId);
const displayName = getDisplayName(profile);
```

#### Profile Table Structure
- Primary key: `id UUID` (references `auth.users.id`)
- Columns: `full_name TEXT`, `preferred_name TEXT`, `avatar_url TEXT`
- RLS: Users can only read/update their own profile (`auth.uid() = id`)
- Source: `supabase/profile-avatars.sql:55-74`

#### Signup Flow
**File**: `src/app/signup/actions.ts:57-60`
```typescript
await service.from("profiles").upsert({
  id: data.user.id,
  full_name: fullName,
});
```
Uses `data.user.id` from Supabase auth response + `fullName` from form input.

#### Possible Root Causes

**A. Session/Cookie Mix-Up** ⚠️ MOST LIKELY
- Supabase auth cookie contains wrong `user.id`
- Browser cached old session from previous user
- Session token issued for wrong user during signup/login
- Shared device/browser with multiple accounts

**B. Profile Data Corruption**
- `profiles` table has incorrect `full_name` for Nikhita's `user.id`
- Data was written incorrectly during account creation
- Two users' profile data got swapped in database

**C. Query Result Mix-Up**
- Race condition in profile loading under concurrent requests
- Supabase connection pooling returned wrong result
- React cache (`src/lib/supabase/cached-session.ts`) mixed up users

**D. Form Input Error**
- During signup, Nikhita's form somehow submitted "Arshdeep" as full name
- Less likely if she saw correct name initially, then wrong name later

#### Required Checks

**1. Database Integrity Check** (RUN THIS FIRST)
```sql
-- Find Nikhita's profile
SELECT 
  p.id as profile_id,
  u.email as auth_email,
  p.full_name,
  p.preferred_name,
  p.created_at as profile_created,
  u.created_at as auth_created
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email ILIKE '%nikhita%' OR u.email ILIKE '%bhamra%'
   OR p.full_name ILIKE '%nikhita%' OR p.full_name ILIKE '%bhamra%';

-- Find Arshdeep's profile  
SELECT 
  p.id as profile_id,
  u.email as auth_email,
  p.full_name,
  p.preferred_name,
  p.created_at as profile_created,
  u.created_at as auth_created
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email ILIKE '%arshdeep%'
   OR p.full_name ILIKE '%arshdeep%';

-- Check for profile/email mismatches (CRITICAL)
SELECT 
  p.id,
  u.email,
  p.full_name,
  p.preferred_name,
  CASE 
    WHEN p.full_name ILIKE '%arshdeep%' AND u.email NOT ILIKE '%arshdeep%' THEN 'MISMATCH'
    WHEN p.full_name ILIKE '%nikhita%' AND u.email NOT ILIKE '%nikhita%' THEN 'MISMATCH'
    ELSE 'OK'
  END as status
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.full_name ILIKE '%arshdeep%' OR p.full_name ILIKE '%nikhita%';
```

**2. User Actions**
Ask Nikhita to:
1. **Clear browser cache and cookies** (completely)
2. **Log out** from all sessions
3. **Log back in** (ideally in incognito/private window)
4. **Report** if name is still wrong

**3. Session Management Audit**
- Check if multiple users share same device/browser
- Review Supabase cookie domain configuration
- Check for any server-side session caching issues

#### Recommendation

**STOP - DO NOT IMPLEMENT FIX YET**

This is a SERIOUS issue. Before any fix:

1. **Confirm scope**: Is this isolated to Nikhita or systemic?
2. **Run database queries**: Check if profile data is actually wrong, or if it's a session/display issue
3. **Check audit logs**: When was the profile last updated? By whom?

**If systemic**: 
- Could affect all users
- Need immediate investigation of signup/login flow
- Potential security issue if users can see other users' data

**If isolated**:
- Likely browser cache or one-time data corruption
- Fix profile data manually, have user clear cache
- Monitor for recurrence

### Status
⏸️ **PAUSED - AWAITING DATABASE CHECK + USER ACTIONS**

---

## #1 - Attendance Sync (App → Notion) Unreliable

### ROOT CAUSE IDENTIFIED ✅

#### Observed Issue
Arshdeep marked attendance in app, got success message, but record never appeared in Notion. Had to manually re-log.

#### Current Flow

**File**: `src/app/dashboard/tutor/attendance-actions.ts:90-220`

**Steps**:
1. **Line 113**: Save to `cohort_lesson_attendance` table (ALWAYS succeeds)
2. **Lines 119-207**: Best-effort Notion sync (wrapped in try-catch)
   - Match students to Notion leads
   - Push attendee list to Notion Lessons Log page
3. **Lines 213-214**: Return success message

**Success Message**:
```typescript
success: `Attendance saved for ${marks.length} student${marks.length === 1 ? "" : "s"}.${notionNote}`
```

Where `notionNote` is:
- `" Notion Attendees updated."` (line 198) - if sync succeeds
- `" Notion sync failed: [error message]."` (lines 203-206) - if sync fails

#### Root Cause Analysis

**This is NOT a code bug** - failures ARE being reported in the message.

**The real issue is UX/communication**:

1. **Message ambiguity**: "Attendance saved" appears first, implying complete success. Failure is appended but easy to miss.
2. **Toast duration**: If using a temporary toast notification, it might disappear before user reads the full message
3. **No persistent status**: No visual indicator shows which attendance records are "synced to Notion" vs "local only"
4. **Cognitive load**: Tutors under time pressure may only glance at "Attendance saved" and assume everything worked

#### Proposed Fixes

**Option A: Separate Success/Warning States** (RECOMMENDED - Quick Fix)
```typescript
// Modify return type
export type AttendanceActionResult = {
  error?: string;
  success?: string;
  warning?: string; // NEW
};

// In saveCohortLessonAttendance
if (notionError) {
  return {
    success: `Attendance saved locally for ${marks.length} student(s).`,
    warning: `Notion sync failed: ${notionError.message}. Records will be retried automatically.`
  };
}

return {
  success: `Attendance saved and synced to Notion for ${marks.length} student(s).${notionNote}`
};
```

**UI changes**:
- Success: Green checkmark, dismissible after 3s
- Warning: Yellow/orange banner, stays visible until manually dismissed
- Persistent indicator: Add small "⚠ Not synced" badge next to attendance entries

**Option B: Block Until Notion Confirms** (Slower UX)
- Don't show success until both DB + Notion succeed
- Shows loading spinner during Notion API call
- Only show success if everything worked
- Downsides: Slower, blocks on external API

**Option C: Add Sync Status Column** (Medium-term)
```sql
ALTER TABLE cohort_lesson_attendance
ADD COLUMN notion_synced_at TIMESTAMPTZ,
ADD COLUMN notion_sync_error TEXT;
```

Then:
- Update Notion sync to write sync status to DB
- Show sync status in attendance UI: "Synced ✓" / "Pending ⏱" / "Failed ⚠"
- Add manual "Retry sync" button for failed entries
- Background job: Auto-retry failed syncs every 30min

#### Implementation Plan

1. **Immediate (Option A)**:
   - Modify `AttendanceActionResult` type
   - Update `saveCohortLessonAttendance` to return separate warning
   - Update UI to show warnings prominently (non-dismissible toast)

2. **Medium-term (Option C)**:
   - Add migration: `cohort_lesson_attendance_notion_sync_status.sql`
   - Update Notion sync to write status/error to DB
   - Add UI column showing sync status
   - Add "Retry sync" button

3. **Long-term**:
   - Background worker to auto-retry failed syncs
   - Admin dashboard showing all pending/failed syncs
   - Notion webhook to confirm sync success

### Status
✅ **ROOT CAUSE FOUND - READY FOR FIX**

**Recommended Action**: Implement Option A immediately (1-2 hours), then Option C as follow-up.

---

## #6 - Duplicate/Incorrect Lesson Entries on Student Dashboards

### Observed Issue
Student dashboard showed repeated date rows for a single lesson; format was "completely non-understandable."

### Investigation Findings

#### Current Query Logic

**Files**:
- `src/lib/lessons/load-lesson-log-progress.ts:64-125`
- `src/lib/lessons/lesson-log-progress.ts:27-41`

**Query Flow**:
```typescript
// 1. Fetch all log entries for cohort, ordered by date
const { data } = await supabase
  .from("cohort_lesson_log_entries")
  .select("id, cohort_id, lesson_date, lesson_title, recording_url, notes, status")
  .in("cohort_id", cohortIds)
  .order("lesson_date", { ascending: true });

// 2. Filter out Cancelled entries
for (const row of data ?? []) {
  if (!isCountableLessonLogStatus(row.status)) continue; // excludes "Cancelled"
  list.push(row);
}

// 3. Assign sequential week numbers
return numberLessonLogEntries(list);
```

**No deduplication**: If there are multiple `cohort_lesson_log_entries` with the same `lesson_date`, they all get shown.

#### Potential Root Causes

**A. Multiple Log Entries for Same Lesson** ⚠️ MOST LIKELY
- Rescheduled lessons create two entries:
  - Original: `lesson_date=2024-10-15`, `status='Scheduled'` or `'Cancelled'`
  - Rescheduled: `lesson_date=2024-10-22`, `status='Completed'`
- Both have `lesson_number=3` (same curriculum lesson)
- Student sees: "Week 3 - Oct 15", "Week 4 - Oct 22" (confusing!)

**B. Notion Sync Creates Duplicates**
- If Notion `UNIQUE(notion_page_id)` constraint isn't enforced
- Multiple syncs might create duplicate rows for same Notion page
- Check: Are there duplicate `notion_page_id` values in DB?

**C. Date Formatting in UI**
- Date shown multiple times per entry in UI component
- Incorrect timezone conversion making same date look different
- Missing grouping/deduplication in rendering logic

#### Required Investigation

**1. Query Actual Database**:
```sql
-- Find duplicate lesson_date entries for a cohort
SELECT 
  cohort_id,
  lesson_date,
  lesson_title,
  lesson_id,
  status,
  notion_page_id,
  COUNT(*) as entry_count
FROM cohort_lesson_log_entries
WHERE cohort_id = '[PROBLEM_COHORT_ID]'
  AND status != 'Cancelled'
GROUP BY cohort_id, lesson_date, lesson_title, lesson_id, status, notion_page_id
HAVING COUNT(*) > 1
ORDER BY lesson_date;

-- Check for multiple entries with same lesson_id
SELECT 
  lesson_id,
  COUNT(*) as log_count,
  STRING_AGG(lesson_date::text || ' (' || status || ')', ', ' ORDER BY lesson_date) as dates_and_statuses
FROM cohort_lesson_log_entries
WHERE cohort_id = '[PROBLEM_COHORT_ID]'
  AND lesson_id IS NOT NULL
GROUP BY lesson_id
HAVING COUNT(*) > 1;
```

**2. Find UI Rendering Code**:
Need to locate component that displays lesson log entries to students.
```bash
grep -r "LessonLogEntry\|lesson.*entries\|weekNumber" src/app/dashboard/ src/components/
```

**3. Review Notion Sync**:
`src/lib/notion/lesson-log-sync.ts` - check for duplicate prevention logic

#### Proposed Fixes (PENDING DATABASE CHECK)

**Option A: Dedupe by lesson_id in Query**
```typescript
// Group by lesson_id, keep most recent "Completed" entry per lesson
const seen = new Map<string, LessonLogEntrySummary>();
for (const entry of entries) {
  const key = entry.lessonId || entry.lessonDate;
  const existing = seen.get(key);
  
  // Prefer Completed > Scheduled, more recent date
  if (!existing || 
      (entry.status === 'Completed' && existing.status !== 'Completed') ||
      (entry.lessonDate > existing.lessonDate && entry.status === existing.status)) {
    seen.set(key, entry);
  }
}
return Array.from(seen.values());
```

**Option B: Add lesson_id Join + Group By lesson_number**
```typescript
// Modify query to join lessons table
const { data } = await supabase
  .from("cohort_lesson_log_entries")
  .select(`
    id, cohort_id, lesson_date, lesson_title, status,
    lessons!inner(lesson_number, title)
  `)
  .in("cohort_id", cohortIds)
  .not("lesson_id", "is", null)
  .order("lesson_date", { ascending: true });

// Then group by lesson_number, show only latest entry per lesson
```

**Option C: UI-Level Deduplication**
```typescript
// In UI component, dedupe by lesson_number before rendering
const uniqueByLesson = entries.reduce((acc, entry) => {
  const key = entry.weekNumber; // or lesson_number if available
  if (!acc.has(key) || entry.status === 'Completed') {
    acc.set(key, entry);
  }
  return acc;
}, new Map());
```

### Status
⏸️ **NEEDS: Database query results + UI code review**

**Next Steps**:
1. Run database queries to confirm duplicates exist
2. Find and review UI rendering component
3. Determine if duplicates are in DB or rendering issue
4. Implement appropriate fix based on findings

---

## #7 & #8 - Cancelled Classes Leave Stale Logs / No Clear Lesson Status Model

### ROOT CAUSE IDENTIFIED ✅

#### Observed Issue
"A class was logged, then cancelled, but the log stayed and had to be deleted manually."

#### Status Model (CONFIRMED WORKING)

**Schema**: `supabase/cohort-lesson-log-admin.sql:16-24`

**Status Values**: `'Scheduled'`, `'Completed'`, `'Cancelled'`

**Filter Logic**: `src/lib/lessons/lesson-log-progress.ts:27-29`
```typescript
export function isCountableLessonLogStatus(status: string | null | undefined): boolean {
  return status !== "Cancelled";
}
```

**How It Works**:
1. Cancelled lessons ARE kept in `cohort_lesson_log_entries` table
2. They are EXCLUDED from completion counts via `isCountableLessonLogStatus`
3. This preserves audit trail - you can see what was cancelled and when

**This is CORRECT behavior** from a technical standpoint.

#### The Real Issue

**User expectation vs. actual behavior**:

| Event | Expected | Actual | Why? |
|-------|----------|--------|------|
| Log lesson as completed | Visible in list | ✓ Visible | - |
| Mark lesson as cancelled | Disappears from view | Still visible | For audit trail |
| Add new rescheduled log | New entry appears | ✓ Appears | - |

**Two possible interpretations**:

**A. Tutor Wants to Hide Cancelled Logs** (UI Filter Issue)
- Cancelled logs should be hidden by default in tutor/student views
- Add toggle: "Show cancelled sessions"
- Keep them in database but filter from display

**B. Status Wasn't Updated When Cancellation Happened** (Workflow Gap)
- Tutor cancelled class in Google Calendar
- Calendar sync didn't auto-update lesson log status to 'Cancelled'
- Tutor had to manually edit the log entry
- Need bidirectional sync: Calendar cancellation → Log status

#### Proposed Fixes

**Immediate (Option A - Quick Win)**:
```typescript
// In lesson log display components, add default filter
function LessonLogList({ entries }: { entries: LessonLogEntrySummary[] }) {
  const [showCancelled, setShowCancelled] = useState(false);
  
  const visibleEntries = showCancelled 
    ? entries 
    : entries.filter(e => e.status !== 'Cancelled');
  
  return (
    <>
      <label>
        <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
        Show cancelled sessions
      </label>
      {visibleEntries.map(entry => (
        <LessonLogEntry key={entry.id} entry={entry} cancelled={entry.status === 'Cancelled'} />
      ))}
    </>
  );
}
```

**CSS for cancelled entries**:
```css
.lesson-log-entry[data-cancelled="true"] {
  opacity: 0.5;
  text-decoration: line-through;
  background: #f5f5f5;
}
```

**Medium-term (Option B - Workflow Integration)**:
1. **Link calendar cancellation → log status**:
   - When tutor cancels event in Google Calendar
   - Calendar sync detects cancellation
   - Auto-update matching `cohort_lesson_log_entries.status` to 'Cancelled'

2. **Rescheduling wizard**:
   - When tutor reschedules a class:
     - Mark original log entry as 'Cancelled'
     - Create new log entry with new date
     - Link them with `rescheduled_from_id` / `rescheduled_to_id` columns

**Long-term (Option C - Full Bidirectional Sync)**:
- Google Calendar ↔ Lesson Log two-way sync
- Calendar event cancelled → Log marked 'Cancelled'
- Calendar event rescheduled → Log updated + audit trail
- Log created in app → Calendar event created
- Conflict resolution for manual edits

### Status
✅ **ROOT CAUSE FOUND - UX FIX NEEDED**

**Recommended Action**: 
1. Implement Option A (hide cancelled by default) - 1 hour
2. Plan Option B (calendar sync) as follow-up feature

---

## #3 - New Cohort Roster Not Visible to Tutor

### Observed Issue
**Jasleen** reported: "No students in this cohort" error blocked adding lesson/unlocking, even though cohort's students had signed up.

### Hypothesis

#### Timing/Caching Issue After Signup
1. Student signs up → creates `cohort_members` + `course_enrollments` rows
2. Tutor immediately opens cohort roster page
3. Query returns empty or stale cached data
4. Tutor can't proceed with adding lesson

#### OR: Account Provisioning Issue (Related to #4/#5)
- Student accounts created but:
  - `cohort_members` rows not inserted?
  - `course_enrollments` created but `cohort_id` is NULL?
  - RLS policy blocks tutor from seeing certain students?

#### Files to Check
- Cohort roster loading: `src/lib/tutoring/load-tutor-dashboard.ts` or similar
- RLS policies: `supabase/tutor-rls-scoping-fixes.sql`
- Signup → cohort assignment: `src/app/signup/actions.ts`, `src/lib/notion/lead-purchase-access-grant.ts`

#### Database Queries Needed

```sql
-- Check Cohort 40 (or recent cohort) and its members
SELECT 
  c.id, 
  c.name, 
  c.starts_at,
  COUNT(DISTINCT cm.user_id) as member_count,
  COUNT(DISTINCT ce.user_id) as enrollment_count,
  MAX(cm.created_at) as last_member_added,
  MAX(ce.created_at) as last_enrollment_added
FROM cohorts c
LEFT JOIN cohort_members cm ON cm.cohort_id = c.id AND cm.left_at IS NULL
LEFT JOIN course_enrollments ce ON ce.cohort_id = c.id
WHERE c.name ILIKE '%cohort 40%'
GROUP BY c.id, c.name, c.starts_at;

-- Check specific student's cohort membership + enrollment
SELECT 
  p.full_name,
  p.preferred_name,
  cm.cohort_id,
  cm.created_at as joined_at,
  cm.left_at,
  ce.delivery_mode,
  ce.course_id,
  c.name as cohort_name
FROM profiles p
LEFT JOIN cohort_members cm ON cm.user_id = p.id AND cm.left_at IS NULL
LEFT JOIN course_enrollments ce ON ce.user_id = p.id AND ce.cohort_id = cm.cohort_id
LEFT JOIN cohorts c ON c.id = cm.cohort_id
WHERE p.id IN ('[STUDENT_ID_1]', '[STUDENT_ID_2]')  -- use IDs of students who signed up
ORDER BY cm.created_at DESC;

-- Check if tutor can see cohort members (RLS test)
-- Run this AS THE TUTOR (using their user_id in auth context)
SELECT 
  cm.user_id,
  p.full_name,
  cm.created_at
FROM cohort_members cm
JOIN profiles p ON p.id = cm.user_id
WHERE cm.cohort_id = '[COHORT_40_ID]'
  AND cm.left_at IS NULL;
```

#### Possible Root Causes

**A. Timing Issue**:
- Roster query cached before signup completed
- Need to add cache invalidation or revalidation

**B. Incomplete Signup**:
- `course_enrollments` created but `cohort_members` not inserted
- Check: Does `grantAccessFromLinkedLeadPackages` also create `cohort_members`?

**C. RLS Policy Too Restrictive**:
- Tutor RLS policy requires specific relationship
- New students don't have that relationship yet

**D. Query Join Mismatch**:
- Roster query joins on wrong column
- New students have data but query doesn't find them

### Status
⏸️ **NOT STARTED - AWAITING DATABASE QUERIES**

**May be related to #4/#5** - all three involve account/cohort provisioning

---

## #5 - Login/Account-Creation Friction

### Observed Issue
**Jeevan** couldn't get into his account properly; needed manual password reset.

### Hypothesis: Related to #3 and #4

All three issues (#3, #4, #5) involve account creation and cohort provisioning. Potential shared root cause:

**Incomplete Account Setup Flow**:
1. Notion lead created with App User ID
2. Student signs up via invitation link
3. Supabase auth user created, BUT:
   - Email confirmation not sent or required?
   - Profile row created but incomplete?
   - `cohort_members` row not inserted? (#3)
   - Wrong profile data written? (#4)
   - Session not persisted properly?
4. Student tries to log in → fails or gets wrong account

### Investigation Plan

**1. Trace Full Signup Flow**
```
Invitation Link → Signup Page → Form Submit → actions.ts → Supabase Auth →
→ DB Trigger (profiles) → lead-sync.ts → lead-purchase-access-grant.ts →
→ Course Access / Cohort Membership → Auth Callback → Dashboard
```

**2. Check Each Failure Point**:
- Email confirmation: Required but not sent?
- Profile trigger: Fails silently if metadata is wrong?
- Notion lead link: Fails → no course access granted?
- Cohort assignment: Not created in `cohort_members`?
- Session persistence: Not saved, requires re-login?

**3. Review Recent Grant-Access Fixes**
The recent fix to `grantAccessFromLinkedLeadPackages` addressed silent failures. Check:
- Was access granted for Jeevan?
- Was it queued for retry in `notion_lead_purchase_grant_queue`?
- Did it eventually succeed, or is it still pending?

**4. Check Password Reset Flow**
- Why did Jeevan need password reset?
- Did signup never create a usable password?
- Or did he forget it / have typo during signup?

### Files to Check
- `src/app/signup/actions.ts:11-120` - Signup action
- `src/app/auth/callback/route.ts` - Auth callback handling
- `src/app/login/actions.ts` - Login flow
- `src/lib/notion/lead-sync.ts:linkLeadsForProfile` - Notion linking
- `src/lib/notion/lead-purchase-access-grant.ts` - Access granting
- `src/lib/auth/remember-last-user.ts` - Session persistence

### Database Queries Needed

```sql
-- Find Jeevan's account and check setup status
SELECT 
  u.id,
  u.email,
  u.created_at as auth_created,
  u.email_confirmed_at,
  u.last_sign_in_at,
  p.full_name,
  p.preferred_name,
  p.notion_lead_page_id,
  COUNT(DISTINCT cm.cohort_id) as cohort_count,
  COUNT(DISTINCT ce.course_id) as course_enrollment_count,
  COUNT(DISTINCT ca.course_id) as course_access_count
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN cohort_members cm ON cm.user_id = u.id AND cm.left_at IS NULL
LEFT JOIN course_enrollments ce ON ce.user_id = u.id
LEFT JOIN course_access ca ON ca.user_id = u.id
WHERE u.email ILIKE '%jeevan%'
GROUP BY u.id, u.email, u.created_at, u.email_confirmed_at, u.last_sign_in_at, 
         p.full_name, p.preferred_name, p.notion_lead_page_id;

-- Check if access grant failed/queued for Jeevan
SELECT *
FROM notion_lead_purchase_grant_queue
WHERE user_id = '[JEEVAN_USER_ID]'
ORDER BY created_at DESC;
```

### Status
⏸️ **NOT STARTED - MAY BE RELATED TO #3/#4**

**Recommended**: Investigate #3, #4, #5 together as they may share root cause in account provisioning flow.

---

## #10 - Irrelevant MCQ Distractors in "Pitcher Match"

### Observed Issue
Some multiple-choice options are unrelated to correct answer's category. Example: emotion-word question with "chota"/"panchi" (small/bird) as options.

### Investigation Needed

**1. Find Distractor Generation Code**
```bash
grep -r "distractor\|wrong.*answer\|mcq.*option" src/lib/games/ src/components/games/
grep -r "pitcher.*match\|Pitcher" src/ --include="*.ts" --include="*.tsx"
```

**2. Check Current Logic**
Possible approaches used:
- **Random pool**: Pick any N words from database
- **Tagged categories**: Words have `category` or `word_type` tags, distractors picked from same category
- **Hardcoded per-question**: Each question has pre-defined options
- **Semantic field**: Use word embeddings or manual grouping

**3. Review Flashcard/Word Schema**
```sql
-- Check if words have category/type tags
SELECT 
  punjabi,
  english,
  category,
  difficulty,
  topic_tags,
  word_class  -- might be called something else
FROM flashcards
WHERE category IS NOT NULL
LIMIT 20;
```

**4. Validate Current Questions**
```sql
-- Find questions with potential mismatched distractors
-- (This query structure depends on how options are stored)
SELECT 
  q.id,
  q.correct_answer,
  q.options,
  c_correct.category as correct_category,
  c_correct.word_class as correct_word_class
FROM quiz_questions q  -- or wherever MCQ data is stored
JOIN flashcards c_correct ON c_correct.punjabi = q.correct_answer
WHERE ...;  -- Add filter to find mismatches
```

### Proposed Fix (PENDING INVESTIGATION)

**Option A: Add Validation + Filtering**
```typescript
function selectDistractors(
  correctAnswer: Flashcard,
  allCards: Flashcard[],
  count: number
): Flashcard[] {
  // 1. Filter to same category/word_class
  const candidates = allCards.filter(card => 
    card.id !== correctAnswer.id &&
    card.category === correctAnswer.category &&
    card.word_class === correctAnswer.word_class &&
    card.difficulty === correctAnswer.difficulty  // optional: match difficulty
  );
  
  // 2. If not enough, broaden to just same word_class
  if (candidates.length < count) {
    candidates = allCards.filter(card =>
      card.id !== correctAnswer.id &&
      card.word_class === correctAnswer.word_class
    );
  }
  
  // 3. Shuffle and take N
  return shuffle(candidates).slice(0, count);
}
```

**Option B: Manual Review + Tag Addition**
1. Add `semantic_field` column to flashcards:
   - Emotions: happy, sad, angry, excited, etc.
   - Animals: dog, bird, cat, elephant, etc.
   - Body parts: hand, foot, head, nose, etc.
   - Household: chair, table, door, window, etc.
2. Update distractor selection to use `semantic_field`
3. Flag existing questions with mismatched distractors for Gurupma to review

**Option C: Content Audit Script**
```typescript
// scripts/audit-mcq-distractors.ts
// For each MCQ question:
// 1. Check if distractors match correct answer's category
// 2. Report mismatches to CSV for Gurupma review
// 3. DO NOT auto-fix content
```

### Status
⏸️ **NOT STARTED**

**Do NOT**:
- Auto-rewrite question content
- Change existing flashcard data without review
- Assume category structure - query DB first

**Next Steps**:
1. Find MCQ generation code
2. Check flashcard schema for existing category/type fields
3. Run audit script to list mismatches
4. Present findings to Gurupma for content review

---

## #12 - No Clear "Saved" Confirmation When Logging

### Observed Issue
Tutors don't know for sure a log was recorded, especially under time pressure.

### Investigation Needed

**1. Find Lesson Logging Code**
```bash
grep -r "save.*log\|submit.*log\|lesson.*log.*action" src/app/dashboard/tutor/ src/lib/lessons/
```

**2. Check Current Confirmation UX**
- Is there a success toast?
- How long does it stay visible?
- Does it persist if user navigates away?
- Is there a visual indicator on the log list (e.g. "Saved ✓" badge)?

**3. Check for Autosave**
- Is there draft preservation if tutor navigates away mid-log?
- Or is all data lost if they leave the page?

### Proposed Fixes

**Option A: Persistent Saved Indicator** (Quick Fix)
```typescript
function LessonLogEntry({ entry, saved }: { entry: LogEntry; saved: boolean }) {
  return (
    <div className="log-entry">
      <h3>{entry.title}</h3>
      {saved && (
        <span className="saved-badge">
          <CheckIcon /> Saved {formatRelativeTime(entry.savedAt)}
        </span>
      )}
      {!saved && (
        <span className="unsaved-badge">
          <ClockIcon /> Draft - not saved yet
        </span>
      )}
    </div>
  );
}
```

**Option B: Improved Toast**
- Non-dismissible success message
- Stays visible for 5 seconds (instead of 2-3)
- Clear visual: green checkmark + "✓ Lesson log saved"
- Option to undo within 5 seconds

**Option C: Autosave + Draft Preservation**
```typescript
// Save draft to localStorage as tutor types
useEffect(() => {
  const timer = setTimeout(() => {
    localStorage.setItem(`lesson-log-draft-${logId}`, JSON.stringify(formData));
  }, 1000);  // Debounce 1s
  return () => clearTimeout(timer);
}, [formData]);

// On mount, check for draft
useEffect(() => {
  const draft = localStorage.getItem(`lesson-log-draft-${logId}`);
  if (draft) {
    const shouldRestore = confirm("Found unsaved draft. Restore it?");
    if (shouldRestore) {
      setFormData(JSON.parse(draft));
    } else {
      localStorage.removeItem(`lesson-log-draft-${logId}`);
    }
  }
}, []);

// Clear draft after successful save
onSaveSuccess(() => {
  localStorage.removeItem(`lesson-log-draft-${logId}`);
});
```

### Status
⏸️ **NOT STARTED**

**Recommended**: Implement Option A + B immediately (1-2 hours), then Option C as follow-up.

---

## #14 - Feedback/Confidence Scores Lack Stage Context

### Observed Issue
Reviewers see raw confidence scores (e.g. lots of "3"s) without knowing if that's expected (normal pre-homework) or a concern (still low post-revision).

### Investigation Needed

**1. Find Feedback Schema**
```sql
-- Check feedback_submissions table
SELECT 
  id,
  user_id,
  lesson_id,
  confidence_score,
  submitted_at,
  -- Is there a stage field?
  stage,  
  lesson_phase,
  checkpoint_type
FROM feedback_submissions
LIMIT 10;
```

**2. Check Where Feedback is Collected**
```bash
grep -r "confidence.*score\|feedback.*submission" src/components/ src/lib/
```

**3. Identify Feedback Collection Points**
- Pre-homework (after live lesson, before homework)
- Post-homework (after homework submitted)
- Post-revision (after tutor feedback + revision)
- Mid-course check-in
- End-of-course retrospective

### Proposed Fix

**Option A: Add Stage Field** (Database + Code)

```sql
-- Migration: feedback-submissions-stage-context.sql
ALTER TABLE feedback_submissions
ADD COLUMN stage TEXT CHECK (stage IN (
  'pre_homework',
  'post_homework',
  'post_revision',
  'mid_course',
  'end_course'
));

CREATE INDEX idx_feedback_submissions_stage ON feedback_submissions(stage);

COMMENT ON COLUMN feedback_submissions.stage IS
  'Lesson phase when feedback was collected: pre_homework (after live lesson), post_homework (after completing homework), post_revision (after tutor feedback), mid_course (check-in), end_course (retrospective)';
```

**Update collection code**:
```typescript
// When collecting feedback, pass stage context
await supabase.from("feedback_submissions").insert({
  user_id: userId,
  lesson_id: lessonId,
  confidence_score: score,
  stage: 'pre_homework',  // NEW
  submitted_at: new Date().toISOString(),
});
```

**Option B: Admin Dashboard Grouping**

```typescript
// Group scores by stage in admin view
function FeedbackReview({ scores }: { scores: FeedbackScore[] }) {
  const byStage = groupBy(scores, s => s.stage);
  
  return (
    <div>
      <h3>Pre-Homework Confidence</h3>
      <ConfidenceChart scores={byStage.pre_homework} expectedRange={[2,3]} />
      
      <h3>Post-Homework Confidence</h3>
      <ConfidenceChart scores={byStage.post_homework} expectedRange={[3,4]} />
      
      <h3>Post-Revision Confidence</h3>
      <ConfidenceChart scores={byStage.post_revision} expectedRange={[4,5]} />
      <Alert>⚠️ If post-revision scores are still &lt;3, flag for extra support</Alert>
    </div>
  );
}
```

**Option C: Contextual Benchmarks**

Add expected ranges per stage:
- Pre-homework: 2-3 is normal (just learned)
- Post-homework: 3-4 expected (practiced)
- Post-revision: 4-5 expected (mastered)

Show color-coded indicators:
- 🟢 Green: Within expected range
- 🟡 Yellow: Slightly below expected
- 🔴 Red: Significantly below expected (needs intervention)

### Status
⏸️ **NOT STARTED**

**Next Steps**:
1. Check if `stage` field already exists in feedback table
2. Identify all feedback collection points in codebase
3. Add migration to add `stage` column if missing
4. Update collection code to pass stage context
5. Update admin dashboard to group/filter by stage

---

## #9 - Inconsistent Vocabulary Across the App (REPORT ONLY)

### Task Scope
**DO NOT FIX** - This is a content audit, not a code fix. Gurupma must approve canonical word choices.

### Observed Issues
Examples flagged:
- "wait" vs. different translation
- "stand" vs. "to stand"
- Other inconsistent English ↔ Punjabi word choices across slides, quizzes, answer keys

### Investigation Plan

**1. Identify Scope**
Where does vocabulary appear?
- Lesson slides (PDFs, Notion)
- Quiz questions and answers
- Flashcards
- Answer keys
- Practice games (tiles, MCQs, etc.)

**2. Extract Vocabulary Lists**

```sql
-- Get all Punjabi-English pairs from flashcards
SELECT DISTINCT
  punjabi,
  english,
  category,
  COUNT(*) as usage_count
FROM flashcards
GROUP BY punjabi, english, category
ORDER BY punjabi, english;

-- Get quiz vocabulary
SELECT DISTINCT
  question_text_punjabi,
  question_text_english,
  correct_answer,
  COUNT(*) as usage_count
FROM quiz_questions
WHERE question_text_punjabi IS NOT NULL
GROUP BY question_text_punjabi, question_text_english, correct_answer
ORDER BY question_text_punjabi;

-- Export to CSV for review
\copy (SELECT ...) TO '/tmp/vocabulary-audit.csv' CSV HEADER;
```

**3. Find Inconsistencies**

```typescript
// scripts/audit-vocabulary-consistency.ts
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

const supabase = createServiceRoleClient();

// 1. Find multiple English translations for same Punjabi word
const { data: flashcards } = await supabase
  .from("flashcards")
  .select("punjabi, english, category");

const byPunjabi = new Map<string, Set<string>>();
for (const card of flashcards || []) {
  if (!byPunjabi.has(card.punjabi)) {
    byPunjabi.set(card.punjabi, new Set());
  }
  byPunjabi.get(card.punjabi)!.add(card.english);
}

// Report Punjabi words with multiple English translations
const inconsistencies = Array.from(byPunjabi.entries())
  .filter(([punjabi, englishSet]) => englishSet.size > 1)
  .map(([punjabi, englishSet]) => ({
    punjabi,
    englishTranslations: Array.from(englishSet),
    count: englishSet.size,
  }));

console.log("Inconsistent translations:", inconsistencies);

// 2. Find same English word with multiple Punjabi translations
// ...

// 3. Check quiz questions against flashcard vocabulary
// ...

// Output CSV for Gurupma review
```

**4. Generate Report**

```markdown
# Vocabulary Inconsistency Report

## Summary
- Total Punjabi words: X
- Words with multiple English translations: Y
- Total English words: Z
- Words with multiple Punjabi translations: W

## Inconsistencies Requiring Review

### Punjabi → Multiple English
| Punjabi | English Options | Locations |
|---------|----------------|-----------|
| ਖੜਾ | "stand", "to stand", "standing" | Flashcard #123, Quiz #45, Lesson 3 slide 7 |
| ... | ... | ... |

### English → Multiple Punjabi
| English | Punjabi Options | Locations |
|---------|----------------|-----------|
| wait | ਉਡੀਕ, ਇੰਤਜ਼ਾਰ | ... |

## Recommendations
For each inconsistency, Gurupma should:
1. Choose canonical translation
2. Document context where variants are acceptable
3. Approve update plan
```

### Status
⏸️ **NOT STARTED - REPORT ONLY**

**DO NOT**:
- Change any vocabulary in lessons, quizzes, flashcards
- Pick canonical version yourself
- Auto-fix inconsistencies

**Deliverable**: CSV/Markdown report of all inconsistencies, with exact locations, for Gurupma to review and approve fixes.

---

## #13 - Unclear Hours/Workload Allocation (REPORT ONLY)

### Task Scope
**DO NOT BUILD** - This requires product decision on what the correct time-tracking buckets should be.

### Observed Issue
Hours/workload tracking is unclear. Needs categories like: teaching, admin, delivery, one-to-ones, community.

### Investigation Plan

**1. Find Current Time-Tracking Structure**

```bash
grep -r "hours\|workload\|time.*track\|timesheet" src/ supabase/ --include="*.ts" --include="*.tsx" --include="*.sql"
```

**2. Check Calendar/Session Schema**

```sql
-- Check tutor_scheduled_sessions table
SELECT 
  id,
  tutor_id,
  session_type,  -- is there a type/category field?
  duration_minutes,
  starts_at,
  event_title,
  -- Other relevant fields?
FROM tutor_scheduled_sessions
LIMIT 20;

-- Check if there's a tutor_hours or workload table
SELECT * FROM information_schema.tables 
WHERE table_name LIKE '%hour%' OR table_name LIKE '%workload%' OR table_name LIKE '%time%';
```

**3. Identify Current Categories**

If time tracking exists, what are current buckets?
- By event type? (group session, one-to-one, meeting, etc.)
- By calendar? (teaching calendar vs. admin calendar)
- By manually tagged categories?

**4. Document Current vs. Desired State**

```markdown
# Hours/Workload Allocation Report

## Current State

### Existing Time Tracking
- [ ] Yes, via `tutor_scheduled_sessions.session_type`
- [ ] Yes, via separate calendar categories
- [ ] Yes, via manual time entry form
- [ ] No structured time tracking exists

### Current Categories (if any)
1. Group teaching sessions
2. One-to-one bookings
3. ??? (other categories)

## Proposed State (Pending Gurupma Approval)

### Proposed Time Buckets
1. **Teaching** - Live group sessions
2. **One-to-ones** - Individual student bookings
3. **Admin** - Grading, feedback, attendance logging
4. **Delivery** - Lesson prep, materials creation
5. **Community** - Office hours, forum moderation, events

### Open Questions for Gurupma
1. Should prep time be tracked separately from live teaching?
2. How should overlapping categories be handled? (e.g. grading during office hours)
3. Should this be auto-tracked from calendar or manual entry?
4. What reports do tutors/admins need? (weekly summary, monthly total, per-cohort breakdown)
```

### Status
⏸️ **NOT STARTED - REPORT ONLY**

**DO NOT**:
- Build new time-tracking system
- Assume time bucket categories
- Modify existing time tracking without approval

**Deliverable**: Report documenting current state + proposed structure, with open questions for Gurupma to answer before implementation.

---

## Summary

### Completed Investigations
| # | Issue | Status | Next Action |
|---|-------|--------|-------------|
| 1 | Attendance sync | ✅ Root cause found | Implement UX fix (Option A) |
| 7/8 | Cancelled class logs | ✅ Root cause found | Implement UI filter |

### Pending Database Checks
| # | Issue | Blocking On |
|---|-------|-------------|
| 4 | Account identity mix-up | Database integrity queries + user actions |
| 3 | Cohort roster not visible | Database queries for cohort/membership data |
| 5 | Login friction | Check if related to #3/#4 |
| 6 | Duplicate lesson entries | Database query for duplicates |

### Pending Code Investigation
| # | Issue | Files to Find |
|---|-------|---------------|
| 10 | MCQ distractors | Pitcher Match game code, distractor selection logic |
| 12 | No saved confirmation | Lesson logging actions + UI |
| 14 | Feedback scores | Feedback schema + collection points |

### Report-Only (No Implementation)
| # | Issue | Deliverable |
|---|-------|-------------|
| 9 | Inconsistent vocabulary | CSV/report of all inconsistencies for Gurupma review |
| 13 | Hours/workload allocation | Report on current state + proposed structure |

---

## Files Reviewed So Far

### Profile/Authentication (#4)
- `src/lib/profile/display-name.ts` - Display name logic
- `src/lib/dashboard/home-data.ts` - Home page data loading
- `src/components/home-greeting-header.tsx` - Name display component
- `src/lib/supabase/cached-session.ts` - Session caching
- `src/app/signup/actions.ts` - Account creation
- `supabase/profile-avatars.sql` - Profiles table RLS
- `supabase/profile-roles.sql` - Role system

### Attendance Sync (#1)
- `src/app/dashboard/tutor/attendance-actions.ts` - Attendance save + Notion sync

### Lesson Logs (#6, #7, #8)
- `supabase/cohort-lesson-log-entries.sql` - Lesson log schema
- `supabase/cohort-lesson-log-admin.sql` - Status field + constraints
- `src/lib/lessons/load-lesson-log-progress.ts` - Query logic
- `src/lib/lessons/lesson-log-progress.ts` - Status filter + week numbering
- `src/lib/lessons/load-student-cohort-course-stats.ts` - Student stats

---

## Next Steps

### Immediate (Can Start Now)
1. **#1 Attendance Sync**: Implement Option A (separate success/warning) - 1-2 hours
2. **#7/8 Cancelled Logs**: Add UI filter to hide cancelled by default - 1 hour

### Awaiting Database Checks
3. **#4 Account Identity**: Run database queries, ask user to clear cache
4. **#3 Cohort Roster**: Run database queries to check membership data
5. **#6 Duplicate Lessons**: Run database query to confirm duplicates exist

### Requires Code Discovery
6. **#10 MCQ Distractors**: Find Pitcher Match code, audit distractor logic
7. **#12 Saved Confirmation**: Find lesson logging UI, add persistent indicator
8. **#14 Feedback Scores**: Check schema, add stage context

### Report Generation
9. **#9 Vocabulary**: Run audit script, export CSV for Gurupma
10. **#13 Hours Tracking**: Document current state, propose structure

---

**DO NOT PROCEED WITH CODE FIXES UNTIL:**
- Database integrity checks complete (#4, #3, #5, #6)
- Root causes confirmed with evidence
- User has attempted suggested workarounds (#4 - cache clear)

**SAFE TO PROCEED NOW:**
- #1 (Attendance) - root cause confirmed, fix is UX improvement
- #7/8 (Cancelled logs) - root cause confirmed, fix is UI filter
