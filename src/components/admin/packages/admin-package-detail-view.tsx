"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  fetchOnboardingChecklist,
  updatePackageInstanceStatus,
  updatePackageRunFields,
  updateStudentPackageMembershipStatus,
  upsertOnboardingChecklist,
} from "@/app/admin/packages/actions";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { PackageRunFormModal } from "@/components/admin/packages/package-run-form-modal";
import type { AdminPackageDetail, OnboardingChecklistRow, PackagesRosterMember } from "@/lib/admin/packages/types";
import {
  PACKAGE_INSTANCE_STATUSES,
  PACKAGE_MEMBERSHIP_STATUSES,
  membershipStatusLabel,
  packageStatusLabel,
  packageStatusPillTone,
} from "@/lib/admin/package-status";
import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import { ui } from "@/lib/ui/styles";

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

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ChecklistModalProps = {
  member: PackagesRosterMember;
  checklistType: "group" | "one_to_one";
  onClose: () => void;
};

function OnboardingChecklistModal({ member, checklistType, onClose }: ChecklistModalProps) {
  const [checklist, setChecklist] = useState<OnboardingChecklistRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    fetchOnboardingChecklist(member.studentPackageId).then((result) => {
      setChecklist(result.checklist);
      setError(result.error ?? null);
      setLoading(false);
    });
  }, [member.studentPackageId]);

  const fields: Array<{ key: keyof OnboardingChecklistRow; label: string; boolean?: boolean }> = [
    { key: "timeAssigned", label: "Time assigned", boolean: true },
    { key: "welcomeEmail", label: "Welcome email", boolean: true },
    { key: "calendarInvite", label: "Calendar invite", boolean: true },
    { key: "tutorNotified", label: "Tutor notified", boolean: true },
    { key: "packageCreated", label: "Package created", boolean: true },
    { key: "whatsappChatMade", label: "WhatsApp chat made", boolean: true },
    { key: "scheduleWhatsappChat", label: "Schedule WhatsApp chat", boolean: true },
    { key: "onboardingCompleted", label: "Onboarding completed", boolean: true },
  ];

  function toggleField(key: keyof OnboardingChecklistRow) {
    if (!checklist) return;
    setChecklist({ ...checklist, [key]: !checklist[key] });
  }

  function save() {
    startTransition(async () => {
      const result = await upsertOnboardingChecklist(member.studentPackageId, checklistType, {
        id: checklist?.id,
        timeAssigned: checklist?.timeAssigned,
        welcomeEmail: checklist?.welcomeEmail,
        calendarInvite: checklist?.calendarInvite,
        tutorNotified: checklist?.tutorNotified,
        packageCreated: checklist?.packageCreated,
        whatsappChatMade: checklist?.whatsappChatMade,
        scheduleWhatsappChat: checklist?.scheduleWhatsappChat,
        onboardingCompleted: checklist?.onboardingCompleted,
        paymentDate: checklist?.paymentDate,
        notes: checklist?.notes,
      });
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Onboarding checklist</h3>
            <p className="text-sm text-zinc-500">{member.label}</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ×
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {!loading && (
          <div className="space-y-3">
            {fields.map((field) => (
              <label key={field.key} className="flex items-center gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={Boolean(checklist?.[field.key])}
                  onChange={() => toggleField(field.key)}
                />
                {field.label}
              </label>
            ))}
            <label className="block text-sm text-zinc-700">
              Payment date
              <input
                type="date"
                value={checklist?.paymentDate ?? ""}
                onChange={(e) =>
                  setChecklist((c) => ({
                    ...(c ?? {
                      id: "",
                      checklistType,
                      timeAssigned: false,
                      welcomeEmail: false,
                      calendarInvite: false,
                      tutorNotified: false,
                      packageCreated: false,
                      whatsappChatMade: false,
                      scheduleWhatsappChat: false,
                      onboardingCompleted: false,
                      paymentDate: null,
                      notes: null,
                    }),
                    paymentDate: e.target.value || null,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-zinc-700">
              Notes
              <textarea
                value={checklist?.notes ?? ""}
                onChange={(e) =>
                  setChecklist((c) => ({
                    ...(c ?? {
                      id: "",
                      checklistType,
                      timeAssigned: false,
                      welcomeEmail: false,
                      calendarInvite: false,
                      tutorNotified: false,
                      packageCreated: false,
                      whatsappChatMade: false,
                      scheduleWhatsappChat: false,
                      onboardingCompleted: false,
                      paymentDate: null,
                      notes: null,
                    }),
                    notes: e.target.value,
                  }))
                }
                rows={3}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              />
            </label>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className={ui.btnPrimary}
            >
              Save checklist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RosterSection({
  title,
  members,
  checklistType,
  onUpdated,
}: {
  title: string;
  members: PackagesRosterMember[];
  checklistType: "group" | "one_to_one";
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
                <button
                  type="button"
                  onClick={() => setChecklistMember(member)}
                  className="text-xs font-semibold text-violet-600 hover:text-violet-500"
                >
                  Checklist →
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {checklistMember && (
        <OnboardingChecklistModal
          member={checklistMember}
          checklistType={checklistType}
          onClose={() => setChecklistMember(null)}
        />
      )}
    </section>
  );
}

type AdminPackageDetailViewProps = {
  detail: AdminPackageDetail;
  tutors: Array<{ id: string; name: string }>;
};

export function AdminPackageDetailView({ detail, tutors }: AdminPackageDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState(detail.name);
  const [tutorId, setTutorId] = useState(detail.tutorId ?? "");
  const [status, setStatus] = useState<PackageInstanceStatus>(detail.status);
  const [startDay, setStartDay] = useState(detail.startDayOfWeek ?? "");
  const [startDate, setStartDate] = useState(detail.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(detail.endDate?.slice(0, 10) ?? "");
  const [capacity, setCapacity] = useState(String(detail.capacity));

  const checklistType = detail.deliveryMode === "group" ? "group" : "one_to_one";

  function saveHeader() {
    startTransition(async () => {
      await updatePackageRunFields(detail.kind, detail.id, {
        name,
        tutorId: tutorId || null,
        startDayOfWeek: startDay || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        capacity: Number(capacity) || detail.capacity,
      });
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
              {detail.packageName ? ` · ${detail.packageName}` : ""}
              {detail.deliveryMode === "group" ? " · Group cohort" : " · 1-1 instance"}
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
            <AdminStatusPill tone={packageStatusPillTone(status)}>
              {packageStatusLabel(status)}
            </AdminStatusPill>
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
              onChange={(e) => setStartDate(e.target.value)}
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
        <RosterSection
          title="Interested"
          members={detail.interested}
          checklistType={checklistType}
          onUpdated={() => router.refresh()}
        />
        <RosterSection
          title="Confirmed"
          members={detail.confirmed}
          checklistType={checklistType}
          onUpdated={() => router.refresh()}
        />
      </div>

      <section className={ui.card}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Lesson log</h2>
        <p className="mt-1 text-xs text-zinc-500">Lessons unlocked for this package run.</p>
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

      {showEditModal && (
        <PackageRunFormModal
          mode="edit"
          initial={detail}
          onClose={() => setShowEditModal(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
