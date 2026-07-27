"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  addPackageRunMember,
  updatePackageInstanceStatus,
  updatePackageRunFields,
  updateStudentPackageMembershipStatus,
} from "@/app/admin/packages/actions";
import { searchAdminMembers, type AdminMemberOption } from "@/app/admin/content/actions";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { OnboardingChecklistModal } from "@/components/admin/onboarding/onboarding-checklist-modal";
import { PackageRunFormModal } from "@/components/admin/packages/package-run-form-modal";
import { PackageSessionLogSection } from "@/components/admin/packages/package-session-log-section";
import type { AdminPackageDetail, AdminPackageKind, PackagesRosterMember } from "@/lib/admin/packages/types";
import {
  PACKAGE_INSTANCE_STATUSES,
  PACKAGE_MEMBERSHIP_STATUSES,
  membershipStatusLabel,
  packageStatusLabel,
  packageStatusPillTone,
} from "@/lib/admin/package-status";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import {
  dateInputFromIso,
  isoFromDateInput,
  PACKAGE_WEEKDAYS,
  weekdayFromDateInput,
} from "@/lib/admin/package-schedule";
import { ui } from "@/lib/ui/styles";

const WEEKDAYS = [...PACKAGE_WEEKDAYS];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function RosterSection({
  title,
  members,
  checklistType,
  showChecklist = true,
  onUpdated,
}: {
  title: string;
  members: PackagesRosterMember[];
  checklistType: "group" | "one_to_one";
  showChecklist?: boolean;
  onUpdated: () => void;
}) {
  const [checklistMember, setChecklistMember] = useState<PackagesRosterMember | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section className={ui.card}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {members.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No students.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100">
          {members.map((member) => (
            <li key={member.studentPackageId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-zinc-900">{member.label}</p>
                {member.email && <p className="text-xs text-zinc-500">{member.email}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {member.isNotionLead ? (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                    {membershipStatusLabel(member.membershipStatus)} · Notion lead
                  </span>
                ) : (
                  <>
                    <select
                      value={member.membershipStatus}
                      onChange={(e) =>
                        startTransition(async () => {
                          await updateStudentPackageMembershipStatus(
                            member.studentPackageId,
                            e.target.value as PackageMembershipStatus
                          );
                          onUpdated();
                        })
                      }
                      disabled={pending}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-xs"
                    >
                      {PACKAGE_MEMBERSHIP_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {membershipStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                    {showChecklist && (
                      <button
                        type="button"
                        onClick={() => setChecklistMember(member)}
                        className="text-xs font-semibold text-violet-600 hover:text-violet-500"
                      >
                        Checklist →
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {checklistMember && (
        <OnboardingChecklistModal
          studentPackageId={checklistMember.studentPackageId}
          studentLabel={checklistMember.label}
          checklistType={checklistType}
          onClose={() => setChecklistMember(null)}
        />
      )}
    </section>
  );
}

function AddPackageRunMemberSection({
  kind,
  runId,
  isCommunity,
  defaultStatus,
  onAdded,
}: {
  kind: AdminPackageKind;
  runId: string;
  isCommunity: boolean;
  defaultStatus: PackageMembershipStatus;
  onAdded: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PackageMembershipStatus>(defaultStatus);
  const [results, setResults] = useState<AdminMemberOption[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setStatus(defaultStatus);
  }, [defaultStatus]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError(null);
      void searchAdminMembers(trimmed).then((response) => {
        setSearching(false);
        if (response.error) {
          setSearchError(response.error);
          setResults([]);
          return;
        }
        setResults(response.results ?? []);
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  function addMember(member: AdminMemberOption) {
    setActionError(null);
    startTransition(async () => {
      const result = await addPackageRunMember(kind, runId, member.userId, status);
      if (result.error) {
        setActionError(result.error);
        return;
      }
      setQuery("");
      setResults([]);
      onAdded();
    });
  }

  return (
    <section className={ui.card}>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Add member</h2>
      <p className="mt-1 text-sm text-zinc-500">
        {isCommunity
          ? "Confirmed members get community course access, all community lessons, and community events."
          : "Add a student to this run as interested or confirmed."}
      </p>
      {!isCommunity && (
        <label className="mt-4 block text-sm text-zinc-700">
          Add as
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PackageMembershipStatus)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
          >
            <option value="interested">Interested</option>
            <option value="waiting_for_payment">Waiting for payment</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </label>
      )}
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        autoComplete="off"
      />
      {searching && <p className="mt-2 text-sm text-zinc-500">Searching…</p>}
      {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}
      {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
      {results.length > 0 && (
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-xl border border-zinc-200 p-1">
          {results.map((member) => (
            <li key={member.userId}>
              <button
                type="button"
                disabled={pending}
                onClick={() => addMember(member)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-violet-50 disabled:opacity-50"
              >
                <span>
                  <span className="block font-medium text-zinc-900">{member.displayName}</span>
                  {member.email && (
                    <span className="block text-xs text-zinc-500">{member.email}</span>
                  )}
                </span>
                <span className="text-xs font-semibold text-violet-600">Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type AdminPackageDetailViewProps = {
  detail: AdminPackageDetail;
  tutors: Array<{ id: string; name: string }>;
  initialRoster?: "interested" | "confirmed" | "waiting_for_payment" | null;
};

export function AdminPackageDetailView({
  detail,
  tutors,
  initialRoster = null,
}: AdminPackageDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState(detail.name);
  const [tutorId, setTutorId] = useState(detail.tutorId ?? "");
  const [status, setStatus] = useState<PackageInstanceStatus>(detail.status);
  const [startDay, setStartDay] = useState(detail.startDayOfWeek ?? "");
  const [startDate, setStartDate] = useState(dateInputFromIso(detail.startDate));
  const [endDate, setEndDate] = useState(dateInputFromIso(detail.endDate));
  const [capacity, setCapacity] = useState(String(detail.capacity));
  const [active, setActive] = useState(detail.active);

  const isCommunity = detail.kind === "community";
  const checklistType = detail.deliveryMode === "group" ? "group" : "one_to_one";
  const addMemberDefaultStatus: PackageMembershipStatus =
    initialRoster === "interested"
      ? "interested"
      : initialRoster === "waiting_for_payment"
        ? "waiting_for_payment"
        : "confirmed";

  useEffect(() => {
    if (!initialRoster) return;
    const el = document.getElementById(`roster-${initialRoster}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialRoster]);

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (!value || startDay) return;
    const weekday = weekdayFromDateInput(value);
    if (weekday) setStartDay(weekday);
  }

  function saveHeader() {
    startTransition(async () => {
      if (isCommunity) {
        await updatePackageRunFields(detail.kind, detail.id, { name, active });
      } else {
        await updatePackageRunFields(detail.kind, detail.id, {
          name,
          tutorId: tutorId || null,
          startDayOfWeek: startDay || null,
          startDate: isoFromDateInput(startDate),
          endDate: isoFromDateInput(endDate),
          capacity: Number(capacity) || detail.capacity,
        });
      }
      router.refresh();
    });
  }

  function saveStatus(next: PackageInstanceStatus) {
    setStatus(next);
    startTransition(async () => {
      await updatePackageInstanceStatus(detail.kind, detail.id, next);
      router.refresh();
    });
  }

  return (
    <div className={ui.page}>
      <Link
        href="/admin/packages"
        className="mb-6 inline-flex text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to packages
      </Link>

      <div className={`mb-8 ${ui.card}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{detail.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {detail.courseName}
              {isCommunity
                ? " · Community membership"
                : detail.packageName
                  ? ` · ${detail.packageName}`
                  : ""}
              {!isCommunity &&
                (detail.deliveryMode === "group" ? " · Group cohort" : " · 1-1 instance")}
              {!detail.active && " · Archived"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className={ui.btnSecondary}
            >
              Edit
            </button>
            {!isCommunity && (
              <AdminStatusPill tone={packageStatusPillTone(status)}>
                {packageStatusLabel(status)}
              </AdminStatusPill>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-700">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>
          {isCommunity ? (
            <label className="flex items-end gap-2 pb-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active (uncheck to hide from new signups)
            </label>
          ) : (
            <>
              <label className="text-sm text-zinc-700">
                Status
                <select
                  value={status}
                  onChange={(e) => saveStatus(e.target.value as PackageInstanceStatus)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                >
                  {PACKAGE_INSTANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {packageStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-zinc-700">
                Tutor
                <select
                  value={tutorId}
                  onChange={(e) => setTutorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-zinc-700">
                Capacity
                <input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                />
              </label>
              <label className="text-sm text-zinc-700">
                Start day
                <select
                  value={startDay}
                  onChange={(e) => setStartDay(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                >
                  <option value="">—</option>
                  {WEEKDAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-zinc-700">
                Delivery
                <input
                  value={detail.deliveryMode === "group" ? "Group" : "1-1 / small-group"}
                  readOnly
                  className="mt-1 w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-zinc-600"
                />
              </label>
              <label className="text-sm text-zinc-700">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                />
              </label>
              <label className="text-sm text-zinc-700">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                />
              </label>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={saveHeader}
          disabled={pending}
          className={`mt-6 ${ui.btnPrimary}`}
        >
          Save changes
        </button>
      </div>

      <div className={`mb-8 ${ui.stack}`}>
        <AddPackageRunMemberSection
          kind={detail.kind}
          runId={detail.id}
          isCommunity={isCommunity}
          defaultStatus={addMemberDefaultStatus}
          onAdded={() => router.refresh()}
        />
        <div id="roster-interested">
          <RosterSection
            title="Interested"
            members={detail.interested}
            checklistType={checklistType}
            showChecklist={!isCommunity}
            onUpdated={() => router.refresh()}
          />
        </div>
        <div id="roster-waiting_for_payment">
          <RosterSection
            title="Waiting for payment"
            members={detail.waitingForPayment}
            checklistType={checklistType}
            showChecklist={!isCommunity}
            onUpdated={() => router.refresh()}
          />
        </div>
        <div id="roster-confirmed">
          <RosterSection
            title="Confirmed"
            members={detail.confirmed}
            checklistType={checklistType}
            showChecklist={!isCommunity}
            onUpdated={() => router.refresh()}
          />
        </div>
      </div>

      {!isCommunity && (
        <PackageSessionLogSection
          kind={detail.kind}
          runId={detail.id}
          entries={detail.sessionLog}
          onLogged={() => router.refresh()}
        />
      )}

      {!isCommunity && (
      <section className={ui.card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Unlocked in Learn
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Curriculum lessons unlocked for students (cohort_lesson_unlocks). Unlock from the lesson
          log edit panel per session.
        </p>
        {detail.lessonLog.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No lessons logged yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {detail.lessonLog.map((entry) => (
              <li key={entry.lessonId} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium text-zinc-900">
                  Lesson {entry.lessonNumber}: {entry.lessonTitle}
                </span>
                <span className="text-zinc-500">{formatDateTime(entry.unlockedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {isCommunity && (
        <section className={ui.card}>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Access</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Confirmed community members automatically receive course access. All community lessons
            unlock without per-lesson tutor unlocks, and community-tier events appear on their
            Events tab.
          </p>
        </section>
      )}

      {showEditModal && (
        <PackageRunFormModal
          mode="edit"
          initial={detail}
          onClose={() => setShowEditModal(false)}
          onSaved={() => router.refresh()}
          onDeleted={() => router.refresh()}
        />
      )}
    </div>
  );
}
