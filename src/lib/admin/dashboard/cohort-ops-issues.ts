import { isUkBankHoliday } from "@/lib/admin/dashboard/uk-bank-holidays";
import {
  formatUkWeekDate,
  formatWeekSequence,
  formatWeekToken,
  inspectCohortWeekNumbers,
  isGuardedCohortClassSession,
  isOneToOneSessionTitle,
  sortCohortWeekSessions,
} from "@/lib/calendar/cohort-week-number-guard";
import { cohortAnchorTitlesByCohort } from "@/lib/calendar/cohort-session-week-number";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";

export const COHORT_OPS_STATUSES = [
  "recruiting",
  "pre_scheduling",
  "scheduled",
  "in_progress",
  "paused",
] as const;

export const COHORTS_SETUP_HREF = "/admin/cohorts-setup";
export const COHORT_SESSION_INTEGRITY_HREF = "/admin/cohort-session-integrity";

const PAGE_SIZE = 1000;
const KIDDA_CLASS_PREFIX = "kidda class - ";

export type CohortOpsIssueCode =
  | "no_tutor"
  | "no_recurring_event"
  | "no_connection"
  | "bank_holiday"
  | "week_sequence"
  | "duplicate_lesson_log"
  | "null_week_number"
  | "mis_tagged";

export type CohortOpsIssue = {
  cohortId: string;
  cohortName: string;
  tutorName: string | null;
  startDate: string | null;
  issueCode: CohortOpsIssueCode;
  issueLabel: string;
  fixUrl: string | null;
  fixInstruction: string | null;
  sessionId: string | null;
  sessionStartsAt: string | null;
  weekRows?: CohortWeekSequenceRow[];
  gapKeys?: string[];
  duplicateEntries?: DuplicateLessonLogEntry[];
};

export type CohortWeekSequenceRow = {
  sessionId: string;
  startsAt: string;
  dateLabel: string;
  weekNumber: number | null;
  weekLabel: string;
  renumberedWeek: number;
};

export type DuplicateLessonLogEntry = {
  entryId: string;
  title: string | null;
  status: string | null;
  lessonLabel: string | null;
  hasRecording: boolean;
  source: string | null;
  notionUrl: string | null;
};

export type DuplicateLessonLogGroup = {
  cohortId: string;
  lessonDate: string;
  entries: DuplicateLessonLogEntry[];
};

export type CohortOpsCohort = {
  id: string;
  name: string;
  status: string;
  tutorId: string | null;
  startDate: string | null;
};

export type CohortOpsSession = {
  id: string;
  cohortId: string;
  title: string;
  startsAt: string;
  status: string;
  weekNumber: number | null;
  googleRecurringEventId: string | null;
  matchMethod: string | null;
};

export type CohortNameRef = {
  id: string;
  name: string;
};

export type CohortOpsInput = {
  cohorts: CohortOpsCohort[];
  cohortNames: CohortNameRef[];
  sessions: CohortOpsSession[];
  activeMemberCountByCohortId: ReadonlyMap<string, number>;
  tutorNameById: ReadonlyMap<string, string | null>;
  connectedTutorIds: ReadonlySet<string>;
  acknowledgedWeekGapKeys?: ReadonlyMap<string, ReadonlySet<string>>;
  duplicateLogGroups?: DuplicateLessonLogGroup[];
};

const SETUP_CODES = new Set<CohortOpsIssueCode>([
  "no_tutor",
  "no_recurring_event",
  "no_connection",
]);

const INTEGRITY_CODES = new Set<CohortOpsIssueCode>([
  "bank_holiday",
  "week_sequence",
  "duplicate_lesson_log",
  "null_week_number",
  "mis_tagged",
]);

const ISSUE_ORDER: CohortOpsIssueCode[] = [
  "no_tutor",
  "no_recurring_event",
  "no_connection",
  "bank_holiday",
  "week_sequence",
  "duplicate_lesson_log",
  "null_week_number",
  "mis_tagged",
];

export const SETUP_ISSUE_BREAKDOWN: Array<{ code: CohortOpsIssueCode; label: string }> = [
  { code: "no_tutor", label: "missing tutor" },
  { code: "no_recurring_event", label: "no Kidda Class series" },
  { code: "no_connection", label: "calendar not connected" },
];

export const INTEGRITY_ISSUE_BREAKDOWN: Array<{ code: CohortOpsIssueCode; label: string }> = [
  { code: "bank_holiday", label: "bank holiday" },
  { code: "week_sequence", label: "week numbers" },
  { code: "duplicate_lesson_log", label: "duplicate lesson logs" },
  { code: "null_week_number", label: "missing week number" },
  { code: "mis_tagged", label: "mis-tagged session" },
];

export function isTestCohortName(name: string | null | undefined): boolean {
  const value = (name ?? "").trim().toLowerCase();
  return value.startsWith("test") || value.startsWith("qa ") || value.includes("qa test");
}

export function isLiveCohortStatus(status: string | null | undefined): boolean {
  return COHORT_OPS_STATUSES.includes(status as (typeof COHORT_OPS_STATUSES)[number]);
}

export function exactKiddaClassTitle(cohortName: string): string {
  return `${KIDDA_CLASS_PREFIX}${cohortName.trim().toLowerCase()}`;
}

export function isExactKiddaClassTitle(title: string, cohortName: string): boolean {
  return title.trim().toLowerCase() === exactKiddaClassTitle(cohortName);
}

export function isWeekIntegrityStatus(status: string | null | undefined): boolean {
  return isLiveCohortStatus(status) || status === "offboarding_complete";
}

export { isOneToOneSessionTitle };

export function distinctCohortCount(issues: CohortOpsIssue[]): number {
  return new Set(issues.map((issue) => issue.cohortId)).size;
}

export function cohortIssueBreakdown(
  issues: CohortOpsIssue[],
  parts: Array<{ code: CohortOpsIssueCode; label: string }>
): string {
  const labels: string[] = [];
  for (const part of parts) {
    const cohorts = new Set(
      issues.filter((issue) => issue.issueCode === part.code).map((issue) => issue.cohortId)
    );
    if (cohorts.size > 0) labels.push(`${part.label} (${cohorts.size})`);
  }
  return labels.join(", ");
}

export function setupIssues(issues: CohortOpsIssue[]): CohortOpsIssue[] {
  return issues.filter((issue) => SETUP_CODES.has(issue.issueCode));
}

export function integrityIssues(issues: CohortOpsIssue[]): CohortOpsIssue[] {
  return issues.filter((issue) => INTEGRITY_CODES.has(issue.issueCode));
}

export async function collectPages<T>(
  loadPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await loadPage(from, from + PAGE_SIZE - 1);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

type IssueDraft = Omit<
  CohortOpsIssue,
  "cohortId" | "cohortName" | "tutorName" | "startDate"
> & { sortAt: string };

export function evaluateCohortOpsIssues(input: CohortOpsInput): CohortOpsIssue[] {
  const namesByKey = new Map<string, CohortNameRef[]>();
  for (const cohort of input.cohortNames) {
    const key = cohort.name.trim().toLowerCase();
    if (!key) continue;
    const list = namesByKey.get(key) ?? [];
    list.push(cohort);
    namesByKey.set(key, list);
  }

  const sessionsByCohort = new Map<string, CohortOpsSession[]>();
  for (const session of input.sessions) {
    const list = sessionsByCohort.get(session.cohortId) ?? [];
    list.push(session);
    sessionsByCohort.set(session.cohortId, list);
  }

  const live = input.cohorts
    .filter((cohort) => isLiveCohortStatus(cohort.status) && !isTestCohortName(cohort.name))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const issues: CohortOpsIssue[] = [];
  for (const cohort of live) {
    const tutorName = cohort.tutorId ? (input.tutorNameById.get(cohort.tutorId) ?? null) : null;
    const sessions = sessionsByCohort.get(cohort.id) ?? [];
    const drafts = [
      ...setupDrafts(cohort, sessions, input),
      ...integrityDrafts(cohort, sessions, namesByKey),
    ];
    drafts.sort(
      (a, b) =>
        ISSUE_ORDER.indexOf(a.issueCode) - ISSUE_ORDER.indexOf(b.issueCode) ||
        a.sortAt.localeCompare(b.sortAt) ||
        (a.sessionId ?? "").localeCompare(b.sessionId ?? "")
    );
    for (const draft of drafts) {
      issues.push({
        cohortId: cohort.id,
        cohortName: cohort.name,
        tutorName,
        startDate: cohort.startDate,
        issueCode: draft.issueCode,
        issueLabel: draft.issueLabel,
        fixUrl: draft.fixUrl,
        fixInstruction: draft.fixInstruction,
        sessionId: draft.sessionId,
        sessionStartsAt: draft.sessionStartsAt,
        weekRows: draft.weekRows,
        gapKeys: draft.gapKeys,
        duplicateEntries: draft.duplicateEntries,
      });
    }
  }

  const weekCohorts = input.cohorts
    .filter((cohort) => isWeekIntegrityStatus(cohort.status) && !isTestCohortName(cohort.name))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const cohort of weekCohorts) {
    const tutorName = cohort.tutorId ? (input.tutorNameById.get(cohort.tutorId) ?? null) : null;
    const sessions = sessionsByCohort.get(cohort.id) ?? [];
    const drafts = [
      weekSequenceDraft(cohort.id, sessions, input.acknowledgedWeekGapKeys?.get(cohort.id)),
      ...duplicateLogDrafts(cohort.id, input.duplicateLogGroups ?? []),
    ].filter((draft): draft is IssueDraft => draft != null);
    for (const draft of drafts) {
      issues.push({
        cohortId: cohort.id,
        cohortName: cohort.name,
        tutorName,
        startDate: cohort.startDate,
        issueCode: draft.issueCode,
        issueLabel: draft.issueLabel,
        fixUrl: draft.fixUrl,
        fixInstruction: draft.fixInstruction,
        sessionId: draft.sessionId,
        sessionStartsAt: draft.sessionStartsAt,
        weekRows: draft.weekRows,
        gapKeys: draft.gapKeys,
        duplicateEntries: draft.duplicateEntries,
      });
    }
  }

  return issues;
}

function setupDrafts(
  cohort: CohortOpsCohort,
  sessions: CohortOpsSession[],
  input: CohortOpsInput
): IssueDraft[] {
  const drafts: IssueDraft[] = [];
  const members = input.activeMemberCountByCohortId.get(cohort.id) ?? 0;
  const expectedTitle = `Kidda Class - ${cohort.name.trim()}`;

  if (!cohort.tutorId) {
    if (members > 0) {
      drafts.push({
        issueCode: "no_tutor",
        issueLabel: "No tutor assigned.",
        fixUrl: `/admin/packages/${cohort.id}`,
        fixInstruction: null,
        sessionId: null,
        sessionStartsAt: null,
        sortAt: "",
      });
    }
  } else if (!input.connectedTutorIds.has(cohort.tutorId)) {
    const tutor = input.tutorNameById.get(cohort.tutorId)?.trim() || "The tutor";
    drafts.push({
      issueCode: "no_connection",
      issueLabel: `${tutor} has not connected Google Calendar.`,
      fixUrl: null,
      fixInstruction: `${tutor} needs to connect Google Calendar from Tutor → Calendar. There is no admin screen that connects it for them.`,
      sessionId: null,
      sessionStartsAt: null,
      sortAt: "",
    });
  }

  const hasKiddaSeries = sessions.some(
    (session) =>
      session.googleRecurringEventId != null &&
      isExactKiddaClassTitle(session.title, cohort.name)
  );
  if (!hasKiddaSeries) {
    drafts.push({
      issueCode: "no_recurring_event",
      issueLabel: `No recurring session titled “${expectedTitle}”.`,
      fixUrl: null,
      fixInstruction: `Link the recurring Google Calendar series titled “${expectedTitle}” from this cohort’s calendar cell on All cohorts. There is no page that opens that cell for this cohort.`,
      sessionId: null,
      sessionStartsAt: null,
      sortAt: "",
    });
  }

  return drafts;
}

function integrityDrafts(
  cohort: CohortOpsCohort,
  sessions: CohortOpsSession[],
  namesByKey: Map<string, CohortNameRef[]>
): IssueDraft[] {
  const drafts: IssueDraft[] = [];
  const ownScheduled = sessions
    .filter(
      (session) =>
        session.status === "scheduled" && isExactKiddaClassTitle(session.title, cohort.name)
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));

  for (const session of ownScheduled) {
    if (!isUkBankHoliday(session.startsAt)) continue;
    const when = formatSessionWhenUk(session.startsAt);
    drafts.push({
      issueCode: "bank_holiday",
      issueLabel: `Class on ${when} is still scheduled on a UK bank holiday.`,
      fixUrl: null,
      fixInstruction:
        "Cancel or move this class off the bank holiday. There is no admin screen that edits one session.",
      sessionId: session.id,
      sessionStartsAt: session.startsAt,
      sortAt: session.startsAt,
    });
  }

  for (const session of ownScheduled) {
    if (session.weekNumber != null) continue;
    const when = formatSessionWhenUk(session.startsAt);
    drafts.push({
      issueCode: "null_week_number",
      issueLabel: `Scheduled class on ${when} has no week number.`,
      fixUrl: null,
      fixInstruction:
        "Set a week number on this class. There is no screen for week renumbering.",
      sessionId: session.id,
      sessionStartsAt: session.startsAt,
      sortAt: session.startsAt,
    });
  }

  const misTagged = sessions
    .filter((session) => !isExactKiddaClassTitle(session.title, cohort.name))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));

  for (const session of misTagged) {
    const draft = misTaggedDraft(cohort, session, namesByKey);
    if (draft) drafts.push(draft);
  }

  return drafts;
}

function misTaggedDraft(
  cohort: CohortOpsCohort,
  session: CohortOpsSession,
  namesByKey: Map<string, CohortNameRef[]>
): IssueDraft | null {
  const title = session.title.trim();
  const lower = title.toLowerCase();
  const when = formatSessionWhenUk(session.startsAt);
  const quoted = `“${title}”`;

  if (lower.startsWith(KIDDA_CLASS_PREFIX)) {
    const suffix = title.slice(KIDDA_CLASS_PREFIX.length).trim();
    const matches = (namesByKey.get(suffix.toLowerCase()) ?? []).filter(
      (match) => match.id !== cohort.id
    );
    if (matches.length === 0) {
      return {
        issueCode: "mis_tagged",
        issueLabel: `${quoted} on ${when} is a Kidda Class title, and no other cohort is named “${suffix}”.`,
        fixUrl: null,
        fixInstruction:
          "This session is stored on the wrong cohort. There is no screen that moves a session between cohorts.",
        sessionId: session.id,
        sessionStartsAt: session.startsAt,
        sortAt: session.startsAt,
      };
    }
    const target =
      matches.length === 1
        ? matches[0]!.name
        : matches.map((match) => `${match.name} (${match.id})`).join(", ");
    return {
      issueCode: "mis_tagged",
      issueLabel: `${quoted} on ${when} belongs on ${target}.`,
      fixUrl: null,
      fixInstruction: `Move this session onto ${target}. There is no screen that moves a session between cohorts.`,
      sessionId: session.id,
      sessionStartsAt: session.startsAt,
      sortAt: session.startsAt,
    };
  }

  if (!isOneToOneSessionTitle(title)) return null;
  return {
    issueCode: "mis_tagged",
    issueLabel: `${quoted} on ${when} is a 1-1 session attached to this cohort.`,
    fixUrl: null,
    fixInstruction:
      "This 1-1 session does not belong on a group cohort. There is no screen that moves it off the cohort.",
    sessionId: session.id,
    sessionStartsAt: session.startsAt,
    sortAt: session.startsAt,
  };
}

function weekSequenceDraft(
  cohortId: string,
  sessions: CohortOpsSession[],
  acknowledgedGapKeys: ReadonlySet<string> | undefined
): IssueDraft | null {
  const anchors = cohortAnchorTitlesByCohort(
    sessions.map((session) => ({
      cohort_id: cohortId,
      title: session.title,
      status: session.status,
      match_method: session.matchMethod,
    }))
  ).get(cohortId);
  const classSessions = sessions.filter((session) =>
    isGuardedCohortClassSession(
      {
        cohort_id: cohortId,
        title: session.title,
        status: session.status,
        match_method: session.matchMethod,
      },
      anchors
    )
  );
  const weekSessions = classSessions.map((session) => ({
    id: session.id,
    startsAt: session.startsAt,
    weekNumber: session.weekNumber,
  }));
  const report = inspectCohortWeekNumbers(weekSessions);
  const openGaps = report.gaps.filter((gap) => !acknowledgedGapKeys?.has(gap.key));
  if (report.duplicates.length === 0 && report.outOfOrder.length === 0 && openGaps.length === 0) {
    return null;
  }

  const ordered = sortCohortWeekSessions(weekSessions);
  const parts: string[] = [formatWeekSequence(weekSessions)];
  if (report.duplicates.length > 0) {
    parts.push(`Duplicate weeks ${report.duplicates.join(", ")}.`);
  }
  if (report.outOfOrder.length > 0) {
    const hit = report.outOfOrder[0]!;
    const later = ordered.find((session) => session.id === hit.sessionId);
    parts.push(
      `Out of order: ${later ? formatUkWeekDate(later.startsAt) : "a later class"} is week ${hit.weekNumber} after week ${hit.previousWeekNumber}.`
    );
  }
  if (openGaps.length > 0) {
    parts.push(`Gap ${openGaps.map((gap) => gap.key).join(", ")}.`);
  }

  return {
    issueCode: "week_sequence",
    issueLabel: parts.join(" "),
    fixUrl: null,
    fixInstruction:
      openGaps.length > 0
        ? "Gaps can stay. Mark a gap as intentional, or renumber every class by date."
        : "Renumber these classes by date so each week number is used once, in order.",
    sessionId: null,
    sessionStartsAt: null,
    sortAt: ordered[0]?.startsAt ?? "",
    weekRows: ordered.map((session, index) => ({
      sessionId: session.id,
      startsAt: session.startsAt,
      dateLabel: formatUkWeekDate(session.startsAt),
      weekNumber: session.weekNumber,
      weekLabel: formatWeekToken(session.weekNumber),
      renumberedWeek: index + 1,
    })),
    gapKeys: openGaps.map((gap) => gap.key),
  };
}

function duplicateLogDrafts(
  cohortId: string,
  groups: DuplicateLessonLogGroup[]
): IssueDraft[] {
  return groups
    .filter((group) => group.cohortId === cohortId && group.entries.length > 1)
    .map((group) => ({
      issueCode: "duplicate_lesson_log" as const,
      issueLabel: `${group.entries.length} lesson logs on ${formatLessonDate(group.lessonDate)}.`,
      fixUrl: null,
      fixInstruction:
        "Dismiss the extra log. Dismissed rows stay in the database and drop out of lesson linking and completed counts.",
      sessionId: null,
      sessionStartsAt: null,
      sortAt: group.lessonDate,
      duplicateEntries: group.entries,
    }));
}

function formatLessonDate(value: string): string {
  const day = value.slice(0, 10);
  const date = new Date(`${day}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
