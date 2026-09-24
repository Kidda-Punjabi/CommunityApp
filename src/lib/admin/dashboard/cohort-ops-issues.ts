import { isUkBankHoliday } from "@/lib/admin/dashboard/uk-bank-holidays";
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
};

const SETUP_CODES = new Set<CohortOpsIssueCode>([
  "no_tutor",
  "no_recurring_event",
  "no_connection",
]);

const INTEGRITY_CODES = new Set<CohortOpsIssueCode>([
  "bank_holiday",
  "week_sequence",
  "null_week_number",
  "mis_tagged",
]);

const ISSUE_ORDER: CohortOpsIssueCode[] = [
  "no_tutor",
  "no_recurring_event",
  "no_connection",
  "bank_holiday",
  "week_sequence",
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

export function isOneToOneSessionTitle(title: string): boolean {
  return /\b1\s*[-–:]\s*1\b/i.test(title) || /\bone[\s-]to[\s-]one\b/i.test(title);
}

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

  const weekLabel = weekSequenceLabel(ownScheduled.map((session) => session.weekNumber));
  if (weekLabel) {
    drafts.push({
      issueCode: "week_sequence",
      issueLabel: weekLabel,
      fixUrl: null,
      fixInstruction:
        "Renumber these classes so week numbers run 1, 2, 3… with no duplicates. There is no screen for week renumbering.",
      sessionId: null,
      sessionStartsAt: null,
      sortAt: "",
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

function weekSequenceLabel(weekNumbers: Array<number | null>): string | null {
  const weeks = weekNumbers.filter((week): week is number => week != null);
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const week of weeks) {
    if (seen.has(week)) duplicates.add(week);
    seen.add(week);
  }
  const unique = [...seen].sort((a, b) => a - b);
  const gaps: string[] = [];
  if (unique.length > 0 && unique[0] !== 1) gaps.push(`starts at ${unique[0]}`);
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index] !== unique[index - 1]! + 1) {
      gaps.push(`${unique[index - 1]} → ${unique[index]}`);
    }
  }
  if (duplicates.size === 0 && gaps.length === 0) return null;

  const parts: string[] = [];
  if (duplicates.size > 0) {
    parts.push(`duplicated weeks ${[...duplicates].sort((a, b) => a - b).join(", ")}`);
  }
  if (gaps.length > 0) {
    parts.push(`not continuous from 1 (${gaps.join("; ")})`);
  }
  return `Week numbers are ${parts.join(" and ")}.`;
}
