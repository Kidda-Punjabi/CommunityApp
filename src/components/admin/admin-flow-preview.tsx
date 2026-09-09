"use client";

import { useMemo, useState } from "react";
import type { AdminMemberOption } from "@/app/admin/content/actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import {
  fetchPreviewRescheduleSlots,
  loadFlowPreviewCohortSessions,
  loadFlowPreviewOneToOneSessions,
  loadFlowPreviewStudent,
  loadFlowPreviewStudentSessions,
  type FlowPreviewEnrollmentOption,
  type FlowPreviewStudentContext,
} from "@/app/admin/flow-preview/actions";
import { AdminHubPage } from "@/components/admin/admin-hub-list";
import { AdminMemberSearch } from "@/components/admin/admin-member-search";
import { StudentLessonDetailView } from "@/components/schedule/student-lesson-detail-view";
import { UpcomingLessonsList } from "@/components/schedule/upcoming-lessons-list";
import { formatSessionWhen } from "@/lib/calendar/reschedule-policy";
import type {
  CohortSwitchSubmitInput,
  PreviewActionResult,
  RescheduleSubmitInput,
  SchedulePreviewHandlers,
} from "@/lib/calendar/schedule-preview";
import type { StudentScheduledSession } from "@/lib/calendar/types";
import { ui } from "@/lib/ui/styles";

export type AdminFlowPreviewKind = "cohort-switch" | "session-reschedule";

type SourceMode = "student" | "direct";

const PREVIEW_SUCCESS = "Preview only — this request was not submitted.";

export function AdminFlowPreview({ flow }: { flow: AdminFlowPreviewKind }) {
  const { data } = useAdminData();
  const [sourceMode, setSourceMode] = useState<SourceMode>("student");
  const [member, setMember] = useState<AdminMemberOption | null>(null);
  const [student, setStudent] = useState<FlowPreviewStudentContext | null>(null);
  const [enrollmentKey, setEnrollmentKey] = useState<string>("");
  const [cohortId, setCohortId] = useState("");
  const [sessions, setSessions] = useState<StudentScheduledSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capturedPayload, setCapturedPayload] = useState<unknown>(null);

  const title =
    flow === "cohort-switch" ? "Test Cohort Switch" : "Test Session Reschedule";
  const description =
    flow === "cohort-switch"
      ? "Preview the live group alternate-session request a student sees. Nothing is submitted."
      : "Preview the live 1-to-1 reschedule request a student sees. Nothing is submitted.";

  const selectedEnrollment = student?.enrollments.find((row) => row.key === enrollmentKey) ?? null;
  const selectedSession = sessions.find((row) => row.id === selectedSessionId) ?? null;

  const viewingAs = useMemo(() => {
    if (student) {
      const extra = selectedEnrollment ? ` · ${selectedEnrollment.label}` : "";
      return `${student.displayName}${extra}`;
    }
    if (selectedSession) {
      const cohort = selectedSession.cohortName ? ` · ${selectedSession.cohortName}` : "";
      return `${selectedSession.lessonLabel}${cohort}`;
    }
    return "no target selected";
  }, [student, selectedEnrollment, selectedSession]);

  async function chooseStudent(next: AdminMemberOption) {
    setMember(next);
    setStudent(null);
    setEnrollmentKey("");
    setSessions([]);
    setSelectedSessionId(null);
    setCapturedPayload(null);
    setLoadError(null);
    setLoading(true);
    const result = await loadFlowPreviewStudent(next.userId);
    setLoading(false);
    if (result.error || !result.context) {
      setLoadError(result.error ?? "Could not load student.");
      return;
    }
    setStudent(result.context);
    const first = result.context.enrollments[0];
    const key = result.context.enrollments.length === 1 && first ? first.key : "";
    setEnrollmentKey(key);
    if (result.context.enrollments.length <= 1) {
      await loadStudentSessions(result.context, first?.courseId ?? null);
    }
  }

  async function loadStudentSessions(
    context: FlowPreviewStudentContext,
    courseId: string | null
  ) {
    setLoading(true);
    setLoadError(null);
    setSelectedSessionId(null);
    const result = await loadFlowPreviewStudentSessions(context.userId, context.email, courseId);
    setLoading(false);
    if (result.error) {
      setLoadError(result.error);
      setSessions([]);
      return;
    }
    setSessions(result.sessions);
  }

  async function loadDirectSessions(nextCohortId: string) {
    setCohortId(nextCohortId);
    setSessions([]);
    setSelectedSessionId(null);
    setCapturedPayload(null);
    if (!nextCohortId && flow === "cohort-switch") return;
    setLoading(true);
    setLoadError(null);
    const result =
      flow === "session-reschedule" && !nextCohortId
        ? await loadFlowPreviewOneToOneSessions()
        : await loadFlowPreviewCohortSessions(nextCohortId);
    setLoading(false);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setSessions(result.sessions);
  }

  function intercept<T>(kind: string, input: T): PreviewActionResult {
    setCapturedPayload({ kind, ...input, submitted: false });
    return { success: PREVIEW_SUCCESS };
  }

  const previewHandlers: SchedulePreviewHandlers = {
    onViewLesson: (sessionId) => setSelectedSessionId(sessionId),
    onRescheduleSubmit: async (input: RescheduleSubmitInput) =>
      intercept("lesson_reschedule_requests", input),
    onCohortSwitchSubmit: async (input: CohortSwitchSubmitInput) =>
      intercept("cohort_switch_requests", input),
    onCancelReschedule: async (requestId) =>
      intercept("cancel_lesson_reschedule_request", { requestId }),
    onCancelCohortSwitch: async (requestId) =>
      intercept("cancel_cohort_switch_request", { requestId }),
    loadSlots: (sessionId) => fetchPreviewRescheduleSlots(sessionId, student?.userId ?? null),
  };

  const visibleSessions =
    flow === "cohort-switch"
      ? sessions.filter((session) => session.cohort_id)
      : sessions.filter((session) => !session.cohort_id);

  return (
    <AdminHubPage title={title} description={description}>
      <div
        className="mb-6 rounded-[12px] border-[0.5px] border-amber-400 bg-amber-100 px-4 py-3 text-sm font-semibold text-amber-950"
        role="status"
      >
        PREVIEW MODE — Viewing as: {viewingAs} — nothing will be submitted.
      </div>

      <section className="mb-6 rounded-[12px] border-[0.5px] border-zinc-200 bg-white p-4">
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSourceMode("student");
              setSessions([]);
              setSelectedSessionId(null);
            }}
            className={sourceMode === "student" ? ui.pillActive : ui.pillInactive}
          >
            Search a student
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceMode("direct");
              setMember(null);
              setStudent(null);
              setSessions([]);
              setSelectedSessionId(null);
              if (flow === "session-reschedule") void loadDirectSessions("");
            }}
            className={sourceMode === "direct" ? ui.pillActive : ui.pillInactive}
          >
            Pick cohort + session
          </button>
        </div>

        {sourceMode === "student" ? (
          <div className="space-y-4">
            <AdminMemberSearch selected={member} onSelect={(next) => void chooseStudent(next)} />
            {student && student.enrollments.length > 1 ? (
              <div>
                <label className="block text-sm font-medium text-zinc-700">Active enrollment</label>
                <select
                  value={enrollmentKey}
                  onChange={(event) => {
                    const nextKey = event.target.value;
                    setEnrollmentKey(nextKey);
                    const option = student.enrollments.find((row) => row.key === nextKey);
                    if (option) void loadStudentSessions(student, option.courseId);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                >
                  <option value="">Select enrollment…</option>
                  {student.enrollments.map((row: FlowPreviewEnrollmentOption) => (
                    <option key={row.key} value={row.key}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              {flow === "cohort-switch" ? "Cohort" : "Cohort (optional for 1-to-1 list)"}
            </label>
            <select
              value={cohortId}
              onChange={(event) => void loadDirectSessions(event.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="">
                {flow === "session-reschedule"
                  ? "Upcoming 1-to-1 sessions"
                  : "Select a cohort…"}
              </option>
              {data.cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                  {cohort.courseName ? ` · ${cohort.courseName}` : ""}
                </option>
              ))}
            </select>
            {flow === "session-reschedule" && !cohortId ? (
              <button
                type="button"
                onClick={() => void loadDirectSessions("")}
                className={ui.btnSecondary}
              >
                Load upcoming 1-to-1 sessions
              </button>
            ) : null}
          </div>
        )}

        {loading ? <p className="mt-4 text-sm text-zinc-500">Loading live sessions…</p> : null}
        {loadError ? <p className="mt-4 text-sm text-red-600">{loadError}</p> : null}
      </section>

      {sessions.length > 0 && !selectedSession ? (
        <section className="mb-6">
          {visibleSessions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              {flow === "cohort-switch"
                ? "No upcoming group sessions for this target."
                : "No upcoming 1-to-1 sessions for this target."}
            </p>
          ) : (
            <UpcomingLessonsList sessions={visibleSessions} preview={previewHandlers} />
          )}
        </section>
      ) : null}

      {selectedSession ? (
        <section className="mb-6 rounded-[12px] border-[0.5px] border-zinc-200 bg-white p-4 sm:p-6">
          <StudentLessonDetailView
            session={selectedSession}
            onBack={() => setSelectedSessionId(null)}
            preview={previewHandlers}
          />
        </section>
      ) : null}

      <section className="rounded-[12px] border-[0.5px] border-zinc-200 bg-zinc-50 p-4">
        <h2 className="text-sm font-semibold text-zinc-900">Would-be submit payload</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Captured locally. No insert into lesson_reschedule_requests or cohort_switch_requests.
        </p>
        {capturedPayload ? (
          <pre className="mt-3 overflow-x-auto text-xs text-zinc-800">
            {JSON.stringify(capturedPayload, null, 2)}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            Open a lesson and send a request to see the payload here.
          </p>
        )}
        {selectedSession ? (
          <p className="mt-3 text-xs text-zinc-500">
            Session {selectedSession.id} · {formatSessionWhen(selectedSession.starts_at, selectedSession.ends_at)}
          </p>
        ) : null}
      </section>
    </AdminHubPage>
  );
}
