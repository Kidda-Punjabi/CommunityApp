import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { expandEventOccurrences, type StoredEvent } from "@/lib/events/recurrence";
import { getDisplayName } from "@/lib/profile/display-name";
import { closeApns, retryDeferredPushes, sendPush } from "@/lib/push/send";
import { sweepRecentNotificationPushes } from "@/lib/push/from-notification";
import {
  formatLocalTime,
  inSendWindow,
  isQuietHours,
  isStreakMilestone,
  localDateKey,
  zonedLocalToUtc,
  zonedParts,
} from "@/lib/push/policy";

type Admin = SupabaseClient;

type Pending = {
  userId: string;
  kidProfileId: string | null;
  type: string;
  refKey: string;
  title: string;
  body: string;
  url: string;
  expiresAt?: Date | null;
  mergeId?: string;
  summary?: string;
  alsoLog?: Array<{ type: string; refKey: string }>;
};

type SessionRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  student_id: string | null;
  cohort_id: string | null;
  tutor_id: string;
  meet_link: string | null;
  match_method: string | null;
  lesson_id: string | null;
  status: string;
};

type Recipient = { userId: string; kidProfileId: string | null };

function addDays(year: number, month: number, day: number, days: number) {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function isClassSession(row: SessionRow): boolean {
  if (row.status !== "scheduled") return false;
  if (row.match_method === "unmatched" || row.match_method === "title_name") return false;
  if (row.student_id) return true;
  return Boolean(row.cohort_id && row.title.toLowerCase().includes("kidda class"));
}

async function loadTimezones(admin: Admin, userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let index = 0; index < userIds.length; index += 200) {
    const chunk = userIds.slice(index, index + 200);
    const { data } = await admin.from("profiles").select("id, timezone").in("id", chunk);
    for (const row of data ?? []) {
      map.set(row.id as string, (row.timezone as string | null)?.trim() || "Europe/London");
    }
  }
  return map;
}

async function loadSettings(admin: Admin, userIds: string[]): Promise<Set<string>> {
  const off = new Set<string>();
  for (let index = 0; index < userIds.length; index += 200) {
    const chunk = userIds.slice(index, index + 200);
    const { data } = await admin
      .from("notification_settings")
      .select("user_id, class_reminders, homework_due, community_sessions, streaks, weekly_recap, lesson_scheduling")
      .in("user_id", chunk);
    for (const row of data ?? []) {
      if (row.class_reminders === false) off.add(`${row.user_id}:class_reminders`);
      if (row.homework_due === false) off.add(`${row.user_id}:homework_due`);
      if (row.community_sessions === false) off.add(`${row.user_id}:community_sessions`);
      if (row.streaks === false) off.add(`${row.user_id}:streaks`);
      if (row.weekly_recap === false) off.add(`${row.user_id}:weekly_recap`);
      if (row.lesson_scheduling === false) off.add(`${row.user_id}:lesson_scheduling`);
    }
  }
  return off;
}

function allowed(off: Set<string>, userId: string, category: string): boolean {
  return !off.has(`${userId}:${category}`);
}

async function recipientsForSessions(admin: Admin, sessions: SessionRow[]): Promise<Map<string, Recipient[]>> {
  const result = new Map<string, Recipient[]>();
  const cohortIds = [...new Set(sessions.filter((row) => !row.student_id && row.cohort_id).map((row) => row.cohort_id as string))];
  const members = new Map<string, Recipient[]>();
  if (cohortIds.length > 0) {
    const { data } = await admin
      .from("cohort_members")
      .select("cohort_id, user_id, kid_profile_id")
      .in("cohort_id", cohortIds)
      .is("left_at", null);
    const kidIds = [...new Set((data ?? []).map((row) => row.kid_profile_id).filter(Boolean))] as string[];
    const parents = new Map<string, string>();
    if (kidIds.length > 0) {
      const { data: kids } = await admin.from("kid_profiles").select("id, parent_user_id").in("id", kidIds);
      for (const kid of kids ?? []) parents.set(kid.id as string, kid.parent_user_id as string);
    }
    for (const row of data ?? []) {
      const kidProfileId = (row.kid_profile_id as string | null) ?? null;
      const userId = (row.user_id as string | null) || (kidProfileId ? parents.get(kidProfileId) : null);
      if (!userId) continue;
      const list = members.get(row.cohort_id as string) ?? [];
      list.push({ userId, kidProfileId });
      members.set(row.cohort_id as string, list);
    }
  }

  for (const session of sessions) {
    if (session.student_id) {
      result.set(session.id, [{ userId: session.student_id, kidProfileId: null }]);
    } else if (session.cohort_id) {
      result.set(session.id, members.get(session.cohort_id) ?? []);
    }
  }
  return result;
}

export async function runPushReminders(admin: Admin, now = new Date()): Promise<Record<string, number>> {
  const counts: Record<string, number> = { swept: 0, scheduled: 0, retried: 0 };
  try {
    counts.swept = await sweepRecentNotificationPushes(now);
    counts.scheduled = await sendScheduled(admin, now);
    counts.retried = await retryDeferredPushes(now);
  } finally {
    closeApns();
  }
  return counts;
}

async function sendScheduled(admin: Admin, now: Date): Promise<number> {
  const pending: Pending[] = [];
  await Promise.all([
    collectClassAndHomework(admin, now, pending),
    collectCommunity(admin, now, pending),
    collectStreaks(admin, now, pending),
    collectPolls(admin, now, pending),
    collectUnlocks(admin, now, pending),
  ]);

  const merged = mergeClassAndHomework(pending);
  let sent = 0;
  for (const item of merged) {
    const result = await sendPush({
      userId: item.userId,
      kidProfileId: item.kidProfileId,
      type: item.type,
      refKey: item.refKey,
      title: item.title,
      body: item.body,
      url: item.url,
      expiresAt: item.expiresAt,
      alsoLog: item.alsoLog,
      now,
    });
    if (result === "sent" || result === "deferred" || result === "dropped") sent += 1;
  }
  return sent;
}

function mergeClassAndHomework(pending: Pending[]): Pending[] {
  const groups = new Map<string, Pending[]>();
  const rest: Pending[] = [];
  for (const item of pending) {
    if ((item.type === "C1" || item.type === "H2") && item.mergeId) {
      const list = groups.get(item.mergeId) ?? [];
      list.push(item);
      groups.set(item.mergeId, list);
    } else {
      rest.push(item);
    }
  }
  const merged: Pending[] = [];
  for (const items of groups.values()) {
    const classReminder = items.find((item) => item.type === "C1");
    const homework = items.find((item) => item.type === "H2");
    if (classReminder && homework) {
      merged.push({
        ...homework,
        title: "Class tomorrow",
        body: `${classReminder.summary ?? "Your class"}. Your homework is still to do.`,
        url: classReminder.url,
        alsoLog: [{ type: "C1", refKey: classReminder.refKey }],
      });
      continue;
    }
    merged.push(...items);
  }
  return [...rest, ...merged];
}

async function collectClassAndHomework(admin: Admin, now: Date, pending: Pending[]): Promise<void> {
  const from = new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 40 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("tutor_scheduled_sessions")
    .select("id, title, starts_at, ends_at, student_id, cohort_id, tutor_id, meet_link, match_method, lesson_id, status")
    .eq("status", "scheduled")
    .gte("starts_at", from)
    .lte("starts_at", to);
  const sessions = ((data ?? []) as SessionRow[]).filter(isClassSession);
  if (sessions.length === 0) return;

  const recipients = await recipientsForSessions(admin, sessions);
  const userIds = [...new Set([...recipients.values()].flat().map((item) => item.userId))];
  const tutorIds = [...new Set(sessions.map((session) => session.tutor_id))];
  const lessonIds = [...new Set(sessions.map((session) => session.lesson_id).filter(Boolean))] as string[];
  const [timezones, settingsOff, tutors, lessons, homeworkLessons, submissions] = await Promise.all([
    loadTimezones(admin, userIds),
    loadSettings(admin, userIds),
    admin.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds),
    lessonIds.length
      ? admin.from("lessons").select("id, title").in("id", lessonIds)
      : Promise.resolve({ data: [] }),
    lessonIds.length
      ? admin.from("lesson_segments").select("lesson_id").in("lesson_id", lessonIds).eq("activity_type", "homework")
      : Promise.resolve({ data: [] }),
    lessonIds.length
      ? admin.from("homework_submissions").select("student_id, kid_profile_id, lesson_id").in("lesson_id", lessonIds)
      : Promise.resolve({ data: [] }),
  ]);

  const tutorName = new Map(
    (tutors.data ?? []).map((tutor) => [tutor.id as string, getDisplayName(tutor) ?? "your tutor"])
  );
  const lessonTitle = new Map((lessons.data ?? []).map((lesson) => [lesson.id as string, lesson.title as string]));
  const hasHomework = new Set((homeworkLessons.data ?? []).map((row) => row.lesson_id as string));
  const submitted = new Set(
    (submissions.data ?? []).map(
      (row) => `${(row.kid_profile_id as string | null) ?? (row.student_id as string)}:${row.lesson_id}`
    )
  );

  for (const session of sessions) {
    const people = recipients.get(session.id) ?? [];
    const starts = new Date(session.starts_at);
    const ends = new Date(session.ends_at ?? session.starts_at);
    const title = (session.lesson_id && lessonTitle.get(session.lesson_id)) || session.title;
    const tutor = tutorName.get(session.tutor_id) ?? "your tutor";
    const lessonId = session.lesson_id;

    for (const person of people) {
      const zone = timezones.get(person.userId) ?? "Europe/London";
      const when = formatLocalTime(session.starts_at, zone);
      const mergeId = `${person.userId}:${person.kidProfileId ?? ""}:${session.id}`;
      const submittedKey = `${person.kidProfileId ?? person.userId}:${lessonId ?? ""}`;
      const homeworkDone = lessonId ? submitted.has(submittedKey) || submitted.has(`${person.userId}:${lessonId}`) : false;

      if (allowed(settingsOff, person.userId, "class_reminders")) {
        const today = zonedParts(now, zone);
        const evening = zonedLocalToUtc(today.year, today.month, today.day, 18, 0, zone);
        const tomorrow = addDays(today.year, today.month, today.day, 1);
        const sessionDay = localDateKey(starts, zone);
        const tomorrowKey = `${tomorrow.year}-${String(tomorrow.month).padStart(2, "0")}-${String(tomorrow.day).padStart(2, "0")}`;
        if (sessionDay === tomorrowKey && inSendWindow(now, evening)) {
          pending.push({
            userId: person.userId,
            kidProfileId: person.kidProfileId,
            type: "C1",
            refKey: session.id,
            title: "Class tomorrow",
            body: `${title} with ${tutor} at ${when}.`,
            summary: `${title} at ${when}`,
            url: `/dashboard/schedule/${session.id}`,
            expiresAt: starts,
            mergeId,
          });
        }
        if (inSendWindow(now, new Date(starts.getTime() - 60 * 60 * 1000))) {
          pending.push({
            userId: person.userId,
            kidProfileId: person.kidProfileId,
            type: "C2",
            refKey: session.id,
            title: "Your class starts in 1 hour",
            body: `${title} at ${when}. Slides and vocab are ready.`,
            url: `/dashboard/schedule/${session.id}`,
            expiresAt: starts,
          });
        }
        if (inSendWindow(now, new Date(starts.getTime() - 5 * 60 * 1000))) {
          pending.push({
            userId: person.userId,
            kidProfileId: person.kidProfileId,
            type: "C3",
            refKey: session.id,
            title: "Class is starting",
            body: `Tap to join ${tutor}'s class.`,
            url: session.meet_link || `/dashboard/schedule/${session.id}`,
            expiresAt: starts,
          });
        }
      }

      if (!lessonId || homeworkDone || !allowed(settingsOff, person.userId, "homework_due")) continue;

      if (hasHomework.has(lessonId) && inSendWindow(now, new Date(ends.getTime() + 2 * 60 * 60 * 1000))) {
        pending.push({
          userId: person.userId,
          kidProfileId: person.kidProfileId,
          type: "H1",
          refKey: lessonId,
          title: "Homework from today's class",
          body: `Your ${title} homework is ready. It takes about 10 minutes.`,
          url: `/dashboard/learn/homework/${lessonId}`,
          expiresAt: new Date(ends.getTime() + 24 * 60 * 60 * 1000),
        });
      }

      let dueTarget = new Date(starts.getTime() - 24 * 60 * 60 * 1000);
      if (isQuietHours(dueTarget, zone)) {
        const startParts = zonedParts(starts, zone);
        const dayBefore = addDays(startParts.year, startParts.month, startParts.day, -1);
        dueTarget = zonedLocalToUtc(dayBefore.year, dayBefore.month, dayBefore.day, 18, 0, zone);
      }
      if (inSendWindow(now, dueTarget)) {
        pending.push({
          userId: person.userId,
          kidProfileId: person.kidProfileId,
          type: "H2",
          refKey: session.id,
          title: "Homework due before tomorrow's class",
          body: `Finish your ${title} homework so ${tutor} can review it.`,
          url: `/dashboard/learn/homework/${lessonId}`,
          expiresAt: starts,
          mergeId,
        });
        await admin.from("homework_due_reminder_logs").insert({
          student_id: person.userId,
          session_id: session.id,
          lesson_id: lessonId,
          reminder_kind: "h2",
        });
      }
      if (inSendWindow(now, new Date(starts.getTime() - 3 * 60 * 60 * 1000))) {
        pending.push({
          userId: person.userId,
          kidProfileId: person.kidProfileId,
          type: "H3",
          refKey: session.id,
          title: "Homework still to do",
          body: `You have 3 hours to submit your ${title} homework.`,
          url: `/dashboard/learn/homework/${lessonId}`,
          expiresAt: starts,
        });
        await admin.from("homework_due_reminder_logs").insert({
          student_id: person.userId,
          session_id: session.id,
          lesson_id: lessonId,
          reminder_kind: "h3",
        });
      }
    }
  }
}

async function collectCommunity(admin: Admin, now: Date, pending: Pending[]): Promise<void> {
  const { data: events } = await admin
    .from("events")
    .select("id, title, description, starts_at, ends_at, location, meeting_url, external_url, required_tier, is_free, recurrence_freq, recurrence_until")
    .eq("required_tier", "community");
  const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const occurrences = (events ?? []).flatMap((event) =>
    expandEventOccurrences(event as StoredEvent, windowStart, windowEnd)
  );
  if (occurrences.length === 0) return;

  const { data: packages } = await admin
    .from("student_packages")
    .select("user_id")
    .eq("course_id", COMMUNITY_COURSE_ID)
    .eq("status", "confirmed");
  const userIds = [...new Set((packages ?? []).map((row) => row.user_id as string))];
  if (userIds.length === 0) return;
  const [timezones, settingsOff] = await Promise.all([
    loadTimezones(admin, userIds),
    loadSettings(admin, userIds),
  ]);

  for (const occurrence of occurrences) {
    const starts = new Date(occurrence.starts_at);
    for (const userId of userIds) {
      if (!allowed(settingsOff, userId, "community_sessions")) continue;
      const zone = timezones.get(userId) ?? "Europe/London";
      const parts = zonedParts(starts, zone);
      const morning = zonedLocalToUtc(parts.year, parts.month, parts.day, 9, 0, zone);
      if (localDateKey(now, zone) === localDateKey(starts, zone) && inSendWindow(now, morning)) {
        pending.push({
          userId,
          kidProfileId: null,
          type: "M1",
          refKey: occurrence.occurrenceId,
          title: "Community session today",
          body: `Speaking practice at ${formatLocalTime(occurrence.starts_at, zone)}. Come practise with your pod.`,
          url: "/dashboard/community",
          expiresAt: starts,
        });
      }
      if (inSendWindow(now, new Date(starts.getTime() - 10 * 60 * 1000))) {
        pending.push({
          userId,
          kidProfileId: null,
          type: "M2",
          refKey: occurrence.occurrenceId,
          title: "Community session is starting",
          body: "Join now and grab your check-in code.",
          url: "/dashboard/community",
          expiresAt: starts,
        });
      }
    }
  }
}

async function collectStreaks(admin: Admin, now: Date, pending: Pending[]): Promise<void> {
  const { data } = await admin
    .from("user_streaks")
    .select("user_id, kid_profile_id, current_streak, last_activity_date, redemption_available, streak_before_break")
    .not("last_activity_date", "is", null);
  const rows = data ?? [];
  if (rows.length === 0) return;
  const userIds = [...new Set(rows.map((row) => row.user_id as string))];
  const [timezones, settingsOff] = await Promise.all([
    loadTimezones(admin, userIds),
    loadSettings(admin, userIds),
  ]);

  const sundayUsers: string[] = [];
  for (const row of rows) {
    const userId = row.user_id as string;
    const kidProfileId = (row.kid_profile_id as string | null) ?? null;
    const zone = timezones.get(userId) ?? "Europe/London";
    const parts = zonedParts(now, zone);
    const today = localDateKey(now, zone);
    const streak = Number(row.current_streak ?? 0);
    const last = (row.last_activity_date as string | null) ?? "";
    const who = kidProfileId ?? userId;

    if (allowed(settingsOff, userId, "streaks")) {
      const hour = kidProfileId ? 18 : 20;
      if (streak >= 2 && last < today && inSendWindow(now, zonedLocalToUtc(parts.year, parts.month, parts.day, hour, 0, zone))) {
        pending.push({
          userId,
          kidProfileId,
          type: "S1",
          refKey: `${who}:${today}`,
          title: `Keep your ${streak}-day streak going`,
          body: "5 minutes of flashcards is all it takes.",
          url: "/dashboard/learn",
          expiresAt: zonedLocalToUtc(parts.year, parts.month, parts.day, 23, 30, zone),
        });
      }
      if (row.redemption_available === true && inSendWindow(now, zonedLocalToUtc(parts.year, parts.month, parts.day, 9, 0, zone))) {
        pending.push({
          userId,
          kidProfileId,
          type: "S2",
          refKey: `${who}:${today}`,
          title: "Your streak ended, but you can save it",
          body: `Practise today to bring back your ${row.streak_before_break ?? streak}-day streak.`,
          url: "/dashboard/learn",
          expiresAt: zonedLocalToUtc(parts.year, parts.month, parts.day, 23, 30, zone),
        });
      }
      if (isStreakMilestone(streak) && last === today) {
        pending.push({
          userId,
          kidProfileId,
          type: "S3",
          refKey: `${who}:${streak}`,
          title: `${streak}-day streak!`,
          body: `You've practised Punjabi ${streak} days in a row. Shabash!`,
          url: "/dashboard/profile",
        });
      }
    }

    if (
      allowed(settingsOff, userId, "weekly_recap") &&
      parts.weekday === "Sun" &&
      inSendWindow(now, zonedLocalToUtc(parts.year, parts.month, parts.day, 18, 0, zone)) &&
      last
    ) {
      const lastDate = new Date(`${last}T12:00:00Z`);
      if (now.getTime() - lastDate.getTime() <= 8 * 24 * 60 * 60 * 1000) sundayUsers.push(userId);
    }
  }

  if (sundayUsers.length === 0) return;
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: lessons }, { data: words }] = await Promise.all([
    admin.from("lesson_progress").select("user_id, lesson_id").in("user_id", sundayUsers.slice(0, 200)).gte("updated_at", since),
    admin.from("flashcard_progress").select("user_id").in("user_id", sundayUsers.slice(0, 200)).gte("last_reviewed_at", since),
  ]);
  const lessonCount = new Map<string, number>();
  for (const row of lessons ?? []) {
    lessonCount.set(row.user_id as string, (lessonCount.get(row.user_id as string) ?? 0) + 1);
  }
  const wordCount = new Map<string, number>();
  for (const row of words ?? []) {
    wordCount.set(row.user_id as string, (wordCount.get(row.user_id as string) ?? 0) + 1);
  }
  for (const row of rows) {
    const userId = row.user_id as string;
    if (!sundayUsers.includes(userId)) continue;
    const zone = timezones.get(userId) ?? "Europe/London";
    const parts = zonedParts(now, zone);
    const week = localDateKey(now, zone);
    pending.push({
      userId,
      kidProfileId: (row.kid_profile_id as string | null) ?? null,
      type: "S4",
      refKey: `${(row.kid_profile_id as string | null) ?? userId}:${week}`,
      title: "Your week in Punjabi",
      body: `${lessonCount.get(userId) ?? 0} lessons, ${wordCount.get(userId) ?? 0} words practised, ${row.current_streak}-day streak.`,
      url: "/dashboard/learn",
    });
  }
}

async function collectPolls(admin: Admin, now: Date, pending: Pending[]): Promise<void> {
  const since = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: polls } = await admin
    .from("forum_polls")
    .select("id, post_id, question, closes_at")
    .gte("closes_at", since)
    .lte("closes_at", now.toISOString());
  if (!polls?.length) return;
  const postIds = polls.map((poll) => poll.post_id as string);
  const pollIds = polls.map((poll) => poll.id as string);
  const [{ data: posts }, { data: votes }] = await Promise.all([
    admin.from("forum_posts").select("id, author_id, status").in("id", postIds),
    admin.from("forum_poll_votes").select("poll_id, user_id").in("poll_id", pollIds),
  ]);
  const postById = new Map((posts ?? []).map((post) => [post.id as string, post]));
  const authorIds = [...new Set((posts ?? []).map((post) => post.author_id).filter(Boolean))] as string[];
  const voterIds = [...new Set((votes ?? []).map((vote) => vote.user_id as string))];
  const { data: blocks } = voterIds.length
    ? await admin.from("forum_user_blocks").select("blocker_id, blocked_id").in("blocker_id", voterIds)
    : { data: [] };
  const blocked = new Set((blocks ?? []).map((row) => `${row.blocker_id}:${row.blocked_id}`));
  void authorIds;

  for (const poll of polls) {
    const post = postById.get(poll.post_id as string);
    if (!post || post.status !== "visible") continue;
    const voters = (votes ?? []).filter((vote) => vote.poll_id === poll.id);
    for (const vote of voters) {
      if (blocked.has(`${vote.user_id}:${post.author_id}`)) continue;
      pending.push({
        userId: vote.user_id as string,
        kidProfileId: null,
        type: "F3",
        refKey: poll.id as string,
        title: "Poll results are in",
        body: `See how everyone voted on "${poll.question}".`,
        url: `/dashboard/community/forum/${poll.post_id}`,
      });
    }
  }
}

async function collectUnlocks(admin: Admin, now: Date, pending: Pending[]): Promise<void> {
  const since = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("student_lesson_unlocks")
    .select("student_id, lesson_id, kid_profile_id, unlocked_at")
    .gte("unlocked_at", since);
  const rows = data ?? [];
  if (rows.length === 0) return;
  const lessonIds = [...new Set(rows.map((row) => row.lesson_id as string))];
  const { data: lessons } = await admin.from("lessons").select("id, title").in("id", lessonIds);
  const titles = new Map((lessons ?? []).map((lesson) => [lesson.id as string, lesson.title as string]));
  for (const row of rows) {
    const lessonId = row.lesson_id as string;
    pending.push({
      userId: row.student_id as string,
      kidProfileId: (row.kid_profile_id as string | null) ?? null,
      type: "C6",
      refKey: lessonId,
      title: "New lesson unlocked",
      body: `${titles.get(lessonId) ?? "A new lesson"} is ready to review.`,
      url: `/dashboard/learn`,
    });
  }
}
