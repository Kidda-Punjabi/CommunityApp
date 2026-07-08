"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assignOnboardingStudentToRun,
  fetchAdminOnboardingQueue,
  fetchPackageRunsForOnboarding,
  toggleOnboardingChecklistField,
  type OnboardingPackageRunOption,
} from "@/app/admin/onboarding/actions";
import { updateStudentPackageMembershipStatus } from "@/app/admin/packages/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { ONBOARDING_CHECKLIST_COLUMNS } from "@/lib/admin/onboarding/checklist-fields";
import type {
  AdminOnboardingCompletedRow,
  AdminOnboardingRow,
  OnboardingQueue,
} from "@/lib/admin/onboarding/types";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";
import {
  membershipStatusLabel,
  packageStatusLabel,
  packageStatusPillTone,
} from "@/lib/admin/package-status";
import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import { ui } from "@/lib/ui/styles";

type QueueFilter = "all" | OnboardingQueue;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function checklistValue(
  row: { checklist: OnboardingChecklistRow | null },
  key: keyof OnboardingChecklistRow
): boolean {
  const value = row.checklist?.[key];
  return typeof value === "boolean" ? value : false;
}

function PackageAssignmentCell({
  row,
  onAssigned,
}: {
  row: AdminOnboardingRow;
  onAssigned: () => void;
}) {
  const [runs, setRuns] = useState<OnboardingPackageRunOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    const result = await fetchPackageRunsForOnboarding(row.courseId, row.deliveryMode);
    setRuns(result.runs);
    setError(result.error ?? null);
    setLoading(false);
  }, [row.courseId, row.deliveryMode]);

  async function handleAssign(runId: string) {
    if (!runId || runId === row.packageRunId) return;
    setPending(true);
    setError(null);
    const result = await assignOnboardingStudentToRun(
      row.studentPackageId,
      row.deliveryMode === "group" ? "cohort" : "package_instance",
      runId
    );
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onAssigned();
  }

  const assigned = Boolean(row.packageRunId);

  return (
    <div className="min-w-[10rem]">
      <select
        value={row.packageRunId ?? ""}
        disabled={pending}
        onFocus={() => void loadRuns()}
        onChange={(e) => void handleAssign(e.target.value)}
        className={`w-full rounded-lg border px-2 py-1.5 text-xs font-medium ${
          assigned
            ? "border-zinc-200 bg-white text-zinc-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
      >
        {!assigned && <option value="">Assign a package</option>}
        {assigned && !loading && runs.length === 0 && row.packageRunId && (
          <option value={row.packageRunId}>{row.packageRunName ?? "Current package"}</option>
        )}
        {loading && <option disabled>Loading…</option>}
        {runs.map((run) => (
          <option key={run.id} value={run.id}>
            {run.name}
          </option>
        ))}
      </select>
      {assigned && row.packageRunHref && (
        <Link
          href={row.packageRunHref}
          className="mt-1 inline-block text-xs font-medium text-violet-600 hover:text-violet-500"
        >
          View package →
        </Link>
      )}
      {row.packageRunStatus && (
        <p className="mt-0.5">
          <AdminStatusPill tone={packageStatusPillTone(row.packageRunStatus)}>
            {packageStatusLabel(row.packageRunStatus)}
          </AdminStatusPill>
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AdminOnboardingSection() {
  const [rows, setRows] = useState<AdminOnboardingRow[]>([]);
  const [completedRows, setCompletedRows] = useState<AdminOnboardingCompletedRow[]>([]);
  const [summary, setSummary] = useState({
    onboardingCount: 0,
    offboardingCount: 0,
    overdueCount: 0,
    completedCount: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [completedSearch, setCompletedSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [statusPending, setStatusPending] = useState<string | null>(null);
  const [checklistPending, setChecklistPending] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await fetchAdminOnboardingQueue();
    setRows(result.rows);
    setCompletedRows(result.completedRows);
    setSummary(result.summary);
    setError(result.error ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#onboarding-row-")) return;
    const target = document.querySelector(hash);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [loading, rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (queueFilter !== "all") {
      list = list.filter((row) => row.queue === queueFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (row) =>
        row.studentLabel.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false) ||
        row.courseName.toLowerCase().includes(q) ||
        (row.packageRunName?.toLowerCase().includes(q) ?? false) ||
        (row.tutorName?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, queueFilter, search]);

  const groupedRows = useMemo(() => {
    const groups = new Map<string, AdminOnboardingRow[]>();
    for (const row of filteredRows) {
      const list = groups.get(row.userId) ?? [];
      list.push(row);
      groups.set(row.userId, list);
    }
    return [...groups.values()];
  }, [filteredRows]);

  const filteredCompletedRows = useMemo(() => {
    const q = completedSearch.trim().toLowerCase();
    if (!q) return completedRows;
    return completedRows.filter(
      (row) =>
        row.studentLabel.toLowerCase().includes(q) ||
        (row.email?.toLowerCase().includes(q) ?? false) ||
        row.courseName.toLowerCase().includes(q) ||
        (row.packageRunName?.toLowerCase().includes(q) ?? false) ||
        (row.tutorName?.toLowerCase().includes(q) ?? false)
    );
  }, [completedRows, completedSearch]);

  async function handleMembershipChange(
    row: AdminOnboardingRow,
    status: PackageMembershipStatus
  ) {
    setStatusPending(row.studentPackageId);
    await updateStudentPackageMembershipStatus(row.studentPackageId, status);
    setStatusPending(null);
    await reload();
  }

  async function handleChecklistToggle(
    row: AdminOnboardingRow,
    field: keyof OnboardingChecklistRow,
    checked: boolean
  ) {
    const pendingKey = `${row.studentPackageId}:${field}`;
    setChecklistPending(pendingKey);

    setRows((current) =>
      current.map((entry) => {
        if (entry.studentPackageId !== row.studentPackageId) return entry;
        const checklist = entry.checklist ?? {
          id: "",
          checklistType: entry.checklistType,
          timeAssigned: false,
          welcomeEmail: false,
          calendarInvite: false,
          tutorNotified: false,
          packageCreated: false,
          whatsappChatMade: false,
          scheduleWhatsappChat: false,
          onboardingCompleted: false,
          paymentDate: entry.paymentDate,
          notes: null,
        };
        return {
          ...entry,
          checklist: { ...checklist, [field]: checked },
        };
      })
    );

    await toggleOnboardingChecklistField(
      row.studentPackageId,
      row.checklistType,
      field,
      checked
    );
    setChecklistPending(null);
    await reload();
  }

  async function handleCompletedReopen(row: AdminOnboardingCompletedRow) {
    setChecklistPending(`${row.studentPackageId}:onboardingCompleted`);
    await toggleOnboardingChecklistField(
      row.studentPackageId,
      row.checklistType,
      "onboardingCompleted",
      false
    );
    setChecklistPending(null);
    await reload();
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Onboarding</h1>
        <p className="mt-1 text-sm text-zinc-500">
          New payments appear here automatically. Tick off setup steps inline and assign each
          student to a package run.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterPill
          label={`Onboarding (${summary.onboardingCount})`}
          active={queueFilter === "onboarding"}
          onClick={() => setQueueFilter((f) => (f === "onboarding" ? "all" : "onboarding"))}
        />
        <AdminFilterPill
          label={`Offboarding (${summary.offboardingCount})`}
          active={queueFilter === "offboarding"}
          onClick={() => setQueueFilter((f) => (f === "offboarding" ? "all" : "offboarding"))}
        />
        {summary.overdueCount > 0 && (
          <AdminStatusPill tone="amber">{summary.overdueCount} overdue</AdminStatusPill>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <input
          type="search"
          placeholder="Search student, course, package, tutor…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <p className="mt-2 text-xs text-zinc-500">
          {filteredRows.length} student{filteredRows.length === 1 ? "" : "s"}
          {queueFilter !== "all" ? ` · ${queueFilter}` : ""}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : groupedRows.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">All caught up</p>
          <p className="mt-2 text-sm text-zinc-500">
            No students need onboarding or offboarding right now.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="min-w-[72rem] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50/95 px-3 py-3">Student</th>
                <th className="px-3 py-3">Queue</th>
                <th className="px-3 py-3">Course</th>
                <th className="px-3 py-3">Package</th>
                <th className="hidden px-3 py-3 md:table-cell">Tutor</th>
                <th className="px-3 py-3">Membership</th>
                <th className="hidden px-3 py-3 sm:table-cell">Payment</th>
                {ONBOARDING_CHECKLIST_COLUMNS.map((column) => (
                  <th key={column.key} className="px-2 py-3 text-center" title={column.label}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {groupedRows.flatMap((group) =>
                group.map((row, indexInGroup) => (
                <tr
                  key={row.studentPackageId}
                  id={`onboarding-row-${row.studentPackageId}`}
                  className="scroll-mt-6 hover:bg-zinc-50/50"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-3">
                    {indexInGroup === 0 ? (
                      <>
                        <p className="font-semibold text-zinc-900">{row.studentLabel}</p>
                        {row.email && <p className="text-xs text-zinc-500">{row.email}</p>}
                        {group.length > 1 ? (
                          <p className="mt-1 text-xs text-violet-600">
                            {group.length} course enrollments
                          </p>
                        ) : null}
                        {row.isOverdue && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Overdue
                          </span>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-zinc-400">↳ same student</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <AdminStatusPill tone={row.queue === "onboarding" ? "violet" : "green"}>
                      {row.queue === "onboarding" ? "Onboard" : "Offboard"}
                    </AdminStatusPill>
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{row.courseName}</td>
                  <td className="px-3 py-3">
                    {row.queue === "onboarding" ? (
                      <PackageAssignmentCell row={row} onAssigned={() => void reload()} />
                    ) : row.packageRunHref && row.packageRunName ? (
                      <Link
                        href={row.packageRunHref}
                        className="font-medium text-violet-600 hover:text-violet-500"
                      >
                        {row.packageRunName}
                      </Link>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="hidden px-3 py-3 text-zinc-600 md:table-cell">
                    {row.tutorName ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      value={row.membershipStatus}
                      disabled={statusPending === row.studentPackageId}
                      onChange={(e) =>
                        void handleMembershipChange(
                          row,
                          e.target.value as PackageMembershipStatus
                        )
                      }
                      className="w-full max-w-[9rem] rounded-lg border border-zinc-200 px-2 py-1 text-xs"
                    >
                      {(
                        ["interested", "waiting_for_payment", "confirmed", "withdrawn"] as const
                      ).map((status) => (
                        <option key={status} value={status}>
                          {membershipStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-3 text-zinc-600 sm:table-cell">
                    {formatDate(row.paymentDate ?? row.purchasedAt.slice(0, 10))}
                  </td>
                  {ONBOARDING_CHECKLIST_COLUMNS.map((column) => (
                    <td key={column.key} className="px-2 py-3 text-center">
                      {row.queue === "onboarding" ? (
                        <input
                          type="checkbox"
                          checked={checklistValue(row, column.key)}
                          disabled={checklistPending === `${row.studentPackageId}:${column.key}`}
                          title={column.label}
                          onChange={(e) =>
                            void handleChecklistToggle(row, column.key, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-zinc-300 text-violet-600"
                        />
                      ) : (
                        <span className="text-zinc-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-10">
        <button
          type="button"
          onClick={() => setShowCompleted((open) => !open)}
          className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Previously onboarded</h2>
            <p className="text-xs text-zinc-500">
              Students marked Done on the onboarding checklist ({summary.completedCount})
            </p>
          </div>
          <span className="text-sm font-medium text-violet-600">
            {showCompleted ? "Hide" : "Show"}
          </span>
        </button>

        {showCompleted && (
          <div className="mt-3 space-y-3">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4">
              <input
                type="search"
                placeholder="Search completed onboardings…"
                value={completedSearch}
                onChange={(e) => setCompletedSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
              <p className="mt-2 text-xs text-zinc-500">
                {filteredCompletedRows.length} student
                {filteredCompletedRows.length === 1 ? "" : "s"}
              </p>
            </div>

            {loading ? (
              <p className="text-sm text-zinc-500">Loading…</p>
            ) : filteredCompletedRows.length === 0 ? (
              <div className={`${ui.emptyState} border border-zinc-200/80`}>
                <p className="text-sm font-medium text-zinc-900">No completed onboardings yet</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Tick Done on a student&apos;s checklist to move them here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
                <table className="min-w-[56rem] text-left text-sm">
                  <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Course</th>
                      <th className="px-4 py-3">Package</th>
                      <th className="hidden px-4 py-3 md:table-cell">Tutor</th>
                      <th className="hidden px-4 py-3 sm:table-cell">Payment</th>
                      <th className="px-4 py-3">Completed</th>
                      <th className="px-4 py-3">Membership</th>
                      {ONBOARDING_CHECKLIST_COLUMNS.map((column) => (
                        <th
                          key={column.key}
                          className="px-2 py-3 text-center"
                          title={column.label}
                        >
                          {column.header}
                        </th>
                      ))}
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredCompletedRows.map((row) => (
                      <tr key={row.studentPackageId} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-900">{row.studentLabel}</p>
                          {row.email && <p className="text-xs text-zinc-500">{row.email}</p>}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{row.courseName}</td>
                        <td className="px-4 py-3">
                          {row.packageRunHref && row.packageRunName ? (
                            <Link
                              href={row.packageRunHref}
                              className="font-medium text-violet-600 hover:text-violet-500"
                            >
                              {row.packageRunName}
                            </Link>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                          {row.tutorName ?? "—"}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 sm:table-cell">
                          {formatDate(row.paymentDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(row.completedAt?.slice(0, 10) ?? null)}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusPill tone="green">
                            {membershipStatusLabel(row.membershipStatus)}
                          </AdminStatusPill>
                        </td>
                        {ONBOARDING_CHECKLIST_COLUMNS.map((column) => (
                          <td key={column.key} className="px-2 py-3 text-center">
                            <span
                              className={
                                checklistValue(row, column.key)
                                  ? "text-green-600"
                                  : "text-zinc-300"
                              }
                              title={column.label}
                            >
                              {checklistValue(row, column.key) ? "✓" : "—"}
                            </span>
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={
                              checklistPending === `${row.studentPackageId}:onboardingCompleted`
                            }
                            onClick={() => void handleCompletedReopen(row)}
                            className="text-xs font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
                          >
                            Reopen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
