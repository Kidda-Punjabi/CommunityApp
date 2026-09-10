"use client";

import { useState, useTransition } from "react";
import type { AdminMemberOption } from "@/app/admin/content/actions";
import {
  createAdminCohortReschedule,
  loadAdminRescheduleCandidates,
  loadAdminStudentGroupSessions,
  type AdminRescheduleCandidateOption,
  type AdminStudentGroupSessionOption,
} from "@/app/admin/cohort-switch-requests/actions";
import { AdminMemberSearch } from "@/components/admin/admin-member-search";
import { ui } from "@/lib/ui/styles";

export function AdminAddCohortReschedule({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [student, setStudent] = useState<AdminMemberOption | null>(null);
  const [sessions, setSessions] = useState<AdminStudentGroupSessionOption[]>([]);
  const [fromSessionId, setFromSessionId] = useState("");
  const [candidates, setCandidates] = useState<AdminRescheduleCandidateOption[]>([]);
  const [toSessionId, setToSessionId] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setStudent(null);
    setSessions([]);
    setFromSessionId("");
    setCandidates([]);
    setToSessionId("");
    setLoadError(null);
    setMessage(null);
  }

  async function chooseStudent(next: AdminMemberOption) {
    setStudent(next);
    setFromSessionId("");
    setToSessionId("");
    setCandidates([]);
    setMessage(null);
    setLoadError(null);
    setLoadingSessions(true);
    const result = await loadAdminStudentGroupSessions(next.userId);
    setLoadingSessions(false);
    setSessions(result.sessions);
    setLoadError(result.error ?? null);
  }

  async function chooseFromSession(sessionId: string) {
    setFromSessionId(sessionId);
    setToSessionId("");
    setCandidates([]);
    setMessage(null);
    if (!sessionId) return;
    setLoadingCandidates(true);
    const result = await loadAdminRescheduleCandidates(sessionId);
    setLoadingCandidates(false);
    setCandidates(result.candidates);
    setLoadError(result.error ?? null);
  }

  const fromSession = sessions.find((row) => row.id === fromSessionId) ?? null;
  const toSession = candidates.find((row) => row.id === toSessionId) ?? null;

  return (
    <div className="mb-6">
      {open ? (
        <div className={`${ui.cardBordered} space-y-4`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Add reschedule</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Move a student onto another same-week group session. This invites them to the new
                calendar event only — the original invite is left as-is.
              </p>
            </div>
            <button
              type="button"
              className={ui.btnGhost}
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Close
            </button>
          </div>

          <AdminMemberSearch selected={student} onSelect={(next) => void chooseStudent(next)} />

          {student ? (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">Original session</p>
              {loadingSessions ? (
                <p className="text-sm text-zinc-500">Loading upcoming group sessions…</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No upcoming group class sessions for this student.
                </p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((session) => {
                    const selected = session.id === fromSessionId;
                    return (
                      <li key={session.id}>
                        <button
                          type="button"
                          onClick={() => void chooseFromSession(session.id)}
                          className={
                            selected
                              ? "w-full rounded-2xl border-2 border-violet-500 bg-violet-50 px-4 py-3 text-left"
                              : "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300"
                          }
                        >
                          <p className="font-medium text-zinc-900">{session.cohortName}</p>
                          <p className="mt-0.5 text-sm text-zinc-600">{session.whenLabel}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Tutor: {session.tutorName}
                            {session.weekNumber != null ? ` · Week ${session.weekNumber}` : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {fromSession ? (
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-700">Move to</p>
              {loadingCandidates ? (
                <p className="text-sm text-zinc-500">Loading matching sessions…</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No matching same-week sessions in other cohorts.
                </p>
              ) : (
                <ul className="space-y-2">
                  {candidates.map((option) => {
                    const selected = option.id === toSessionId;
                    return (
                      <li key={option.id}>
                        <button
                          type="button"
                          onClick={() => setToSessionId(option.id)}
                          className={
                            selected
                              ? "w-full rounded-2xl border-2 border-violet-500 bg-violet-50 px-4 py-3 text-left"
                              : "w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300"
                          }
                        >
                          <p className="font-medium text-zinc-900">{option.cohortName}</p>
                          <p className="mt-0.5 text-sm text-zinc-600">{option.whenLabel}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Tutor: {option.tutorName} · Capacity {option.capacityLabel}
                            {option.weekNumber != null ? ` · Week ${option.weekNumber}` : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ) : null}

          {fromSession && toSession ? (
            <div className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              Move {student?.displayName} from {fromSession.cohortName} ({fromSession.whenLabel}) to{" "}
              {toSession.cohortName} ({toSession.whenLabel}).
            </div>
          ) : null}

          {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
          {message ? <p className="text-sm text-zinc-600">{message}</p> : null}

          <button
            type="button"
            disabled={pending || !student || !fromSession || !toSession}
            className={ui.btnPrimary}
            onClick={() => {
              if (!student || !fromSession || !toSession) return;
              startTransition(async () => {
                const result = await createAdminCohortReschedule({
                  studentId: student.userId,
                  fromSessionId: fromSession.id,
                  toSessionId: toSession.id,
                });
                setMessage(result.success ?? result.error ?? null);
                if (result.success) onCreated();
              });
            }}
          >
            {pending ? "Saving…" : "Confirm reschedule"}
          </button>
        </div>
      ) : (
        <button type="button" className={ui.btnSecondary} onClick={() => setOpen(true)}>
          Add reschedule
        </button>
      )}
    </div>
  );
}
