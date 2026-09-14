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
import { fetchLearnContent, filterLessonsForCourse } from "@/lib/learning/load-learn-content";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import {
  findStudentPackageForCourse,
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
  trackId: SwitchCohortTrackId | "kids";
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

async function buildSwitchCohortPageFromPackage(
  supabase: SupabaseClient,
  pkg: StudentPackage,
  params: {
    trackId: SwitchCohortPageData["trackId"];
    backHref: string;
    totalWeeks: number;
  }
): Promise<SwitchCohortPageData> {
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
      totalWeeks: params.totalWeeks,
    }),
  };

  if (!source) {
    return {
      trackId: params.trackId,
      backHref: params.backHref,
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
    rawAlternates.map((option) => toAlternateCard(option, params.totalWeeks, nowMs))
  );

  return {
    trackId: params.trackId,
    backHref: params.backHref,
    sourceSession: source,
    current,
    alternates,
    canRequest: source.canRequestCohortSwitch,
    lockedReason: source.cohortSwitchLockedReason,
    isShortNotice: source.isShortNoticeCohortSwitch,
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
  return buildSwitchCohortPageFromPackage(supabase, pkg, {
    trackId,
    backHref: `/dashboard/learn/${trackId}`,
    totalWeeks: lessons.length,
  });
}

export async function loadKidsSwitchCohortPage(
  supabase: SupabaseClient,
  user: User,
  courseId: string
): Promise<SwitchCohortPageData | null> {
  const [studentPackages, allLessons] = await Promise.all([
    loadStudentPackages(supabase, user),
    fetchLearnContent(supabase),
  ]);

  const pkg = findStudentPackageForCourse(studentPackages, courseId);
  if (!pkg || pkg.deliveryMode !== "group" || !pkg.cohortId) return null;

  const lessons = filterLessonsForCourse(allLessons, courseId);
  return buildSwitchCohortPageFromPackage(supabase, pkg, {
    trackId: "kids",
    backHref: `/dashboard/learn/kids/${courseId}`,
    totalWeeks: lessons.length,
  });
}
