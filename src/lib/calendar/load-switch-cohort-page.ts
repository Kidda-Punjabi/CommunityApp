import "server-only";

import { loadAlternateCohortSessionsForSource } from "@/lib/calendar/load-alternate-cohort-sessions";
import {
  cohortHasStarted,
  currentWeekFromStoredWeekNumber,
  formatAlternateCohortStatus,
  formatCohortSessionDayTime,
  formatStartedWeekProgressLine,
  pickSwitchCohortOptions,
  resolveCohortProgressCurrentWeek,
  type SwitchCohortTrackId,
} from "@/lib/calendar/cohort-week-progress";
import type { AlternateCohortOption, StudentScheduledSession } from "@/lib/calendar/types";
import { filterLessonsForTrack } from "@/lib/learning/learn-access";
import { fetchLearnContent } from "@/lib/learning/load-learn-content";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  findStudentPackageForTrack,
  loadStudentPackages,
  type StudentPackage,
} from "@/lib/packages/load-student-packages";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type SwitchCohortAlternateCard = {
  sessionId: string;
  cohortId: string;
  name: string;
  tutorName: string;
  dayTimeLabel: string;
  statusLabel: string | null;
  hasStarted: boolean;
};

export type SwitchCohortPageData = {
  trackId: SwitchCohortTrackId;
  backHref: string;
  sourceSession: StudentScheduledSession | null;
  current: {
    name: string;
    tutorName: string;
    progressLine: string | null;
  };
  alternates: SwitchCohortAlternateCard[];
  canRequest: boolean;
  lockedReason: string | null;
  isShortNotice: boolean;
};

function toAlternateCard(
  option: AlternateCohortOption,
  totalWeeks: number,
  nowMs: number
): SwitchCohortAlternateCard {
  const weekNumber = option.weekNumber ?? null;
  const hasStarted = cohortHasStarted(option.startDate ?? null, weekNumber, nowMs);
  return {
    sessionId: option.id,
    cohortId: option.cohortId,
    name: option.name,
    tutorName: option.tutorName,
    dayTimeLabel: formatCohortSessionDayTime(option.startsAt, option.endsAt),
    statusLabel: formatAlternateCohortStatus({
      hasStarted,
      currentWeek: weekNumber,
      totalWeeks,
      weekRunsAt: option.startsAt,
      startDateIso: option.startDate ?? null,
    }),
    hasStarted,
  };
}

export async function loadSwitchCohortPage(
  supabase: SupabaseClient,
  user: User,
  trackId: SwitchCohortTrackId
): Promise<SwitchCohortPageData | null> {
  const [access, studentPackages, allLessons] = await Promise.all([
    getCourseAccessContext(supabase, user),
    loadStudentPackages(supabase, user),
    fetchLearnContent(supabase),
  ]);

  const pkg: StudentPackage | null = findStudentPackageForTrack(studentPackages, trackId);
  if (!pkg || pkg.deliveryMode !== "group" || !pkg.cohortId) return null;

  const lessons = filterLessonsForTrack(allLessons, access.courses, pkg.tier);
  const totalWeeks = lessons.length;
  const nowMs = Date.now();
  const source = pkg.groupRescheduleSession;

  const storedWeek =
    source?.week_number ??
    currentWeekFromStoredWeekNumber(
      source
        ? [{ starts_at: source.starts_at, week_number: source.week_number, status: source.status }]
        : [],
      nowMs
    )?.week ??
    null;
  const currentWeek = resolveCohortProgressCurrentWeek({
    startDateIso: pkg.cohortStartDate,
    storedWeek,
    nowMs,
  });

  const current = {
    name: pkg.cohortName ?? "Your cohort",
    tutorName: pkg.tutorName ?? "Tutor",
    progressLine: formatStartedWeekProgressLine({
      startDateIso: pkg.cohortStartDate,
      currentWeek,
      totalWeeks,
    }),
  };

  if (!source) {
    return {
      trackId,
      backHref: `/dashboard/learn/${trackId}`,
      sourceSession: null,
      current,
      alternates: [],
      canRequest: false,
      lockedReason: "No upcoming group session was found for your cohort.",
      isShortNotice: false,
    };
  }

  const rawAlternates = await loadAlternateCohortSessionsForSource(supabase, source);
  const alternates = pickSwitchCohortOptions(
    rawAlternates.map((option) => toAlternateCard(option, totalWeeks, nowMs))
  );

  return {
    trackId,
    backHref: `/dashboard/learn/${trackId}`,
    sourceSession: source,
    current,
    alternates,
    canRequest: source.canRequestCohortSwitch,
    lockedReason: source.cohortSwitchLockedReason,
    isShortNotice: source.isShortNoticeCohortSwitch,
  };
}
