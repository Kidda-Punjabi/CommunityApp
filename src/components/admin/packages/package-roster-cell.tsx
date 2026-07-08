"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import {
  setPackageRunRosterMember,
  withdrawPackageRunRosterMember,
} from "@/app/admin/packages/actions";
import {
  RelationPickerPopover,
  type RelationPickerItem,
} from "@/components/admin/relation-picker-popover";
import type { PackageRosterCandidateOption } from "@/lib/admin/packages/search-package-candidates";
import type {
  AdminPackageKind,
  AdminPackageListRow,
  PackagesRosterMember,
} from "@/lib/admin/packages/types";
import { isPersistedStudentPackageId } from "@/lib/admin/packages/roster-utils";
import type { PackageMembershipStatus } from "@/lib/admin/package-status";

type PackageRosterCellProps = {
  row: AdminPackageListRow;
  status: PackageMembershipStatus;
  members: PackagesRosterMember[];
  onRosterChange: (
    rowKey: { kind: AdminPackageKind; id: string },
    updater: (row: AdminPackageListRow) => AdminPackageListRow
  ) => void;
};

function memberToPickerItem(member: PackagesRosterMember): RelationPickerItem {
  return {
    id: member.studentPackageId,
    userId: member.userId,
    label: member.label,
    email: member.email,
    avatarUrl: member.avatarUrl,
    removable: Boolean(member.userId) && (!member.isNotionLead || isPersistedStudentPackageId(member.studentPackageId)),
  };
}

function memberFromOption(
  option: PackageRosterCandidateOption,
  status: PackageMembershipStatus,
  studentPackageId: string
): PackagesRosterMember {
  return {
    userId: option.userId!,
    label: option.displayName,
    email: option.email,
    avatarUrl: option.avatarUrl,
    studentPackageId,
    membershipStatus: status,
    isNotionLead: false,
  };
}

function allRosterUserIds(row: AdminPackageListRow): string[] {
  const ids = new Set<string>();
  for (const member of [...row.interested, ...row.waitingForPayment, ...row.confirmed]) {
    if (member.userId) ids.add(member.userId);
  }
  return [...ids];
}

function sortMembers(members: PackagesRosterMember[]): PackagesRosterMember[] {
  return [...members].sort((a, b) => a.label.localeCompare(b.label));
}

function rosterFieldForStatus(
  status: PackageMembershipStatus
): "interested" | "waitingForPayment" | "confirmed" {
  if (status === "waiting_for_payment") return "waitingForPayment";
  if (status === "confirmed") return "confirmed";
  return "interested";
}

export function PackageRosterCell({ row, status, members, onRosterChange }: PackageRosterCellProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openPopover = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  function applyOptimisticAdd(
    userId: string,
    option: PackageRosterCandidateOption,
    studentPackageId: string
  ) {
    const nextMember = memberFromOption(option, status, studentPackageId);
    const field = rosterFieldForStatus(status);

    onRosterChange({ kind: row.kind, id: row.id }, (current) => {
      const interested = current.interested.filter((m) => m.userId !== userId);
      const waitingForPayment = current.waitingForPayment.filter((m) => m.userId !== userId);
      const confirmed = current.confirmed.filter((m) => m.userId !== userId);

      return {
        ...current,
        interested: field === "interested" ? sortMembers([...interested, nextMember]) : interested,
        waitingForPayment:
          field === "waitingForPayment"
            ? sortMembers([...waitingForPayment, nextMember])
            : waitingForPayment,
        confirmed: field === "confirmed" ? sortMembers([...confirmed, nextMember]) : confirmed,
      };
    });
  }

  function applyOptimisticRemove(item: RelationPickerItem) {
    const field = rosterFieldForStatus(status);
    onRosterChange({ kind: row.kind, id: row.id }, (current) => ({
      ...current,
      [field]: current[field].filter((member) => member.studentPackageId !== item.id),
    }));
  }

  function handleAdd(candidate: PackageRosterCandidateOption) {
    if (!candidate.userId) return;

    const userId = candidate.userId;
    const previous = members;
    const optimisticId = `optimistic:${userId}`;
    applyOptimisticAdd(userId, candidate, optimisticId);
    setError(null);

    startTransition(async () => {
      const result = await setPackageRunRosterMember({
        kind: row.kind,
        runId: row.id,
        userId,
        status,
        courseId: row.courseId,
        packageId: row.packageId,
      });

      if (result.error) {
        onRosterChange({ kind: row.kind, id: row.id }, (current) => {
          const field = rosterFieldForStatus(status);
          return {
            ...current,
            [field]: previous,
          };
        });
        setError(result.error);
        return;
      }

      if (result.studentPackageId) {
        onRosterChange({ kind: row.kind, id: row.id }, (current) => {
          const field = rosterFieldForStatus(status);
          return {
            ...current,
            [field]: sortMembers(
              current[field].map((member) =>
                member.studentPackageId === optimisticId
                  ? { ...member, studentPackageId: result.studentPackageId! }
                  : member
              )
            ),
          };
        });
      }
    });
  }

  function handleRemove(item: RelationPickerItem) {
    if (!item.userId) return;

    const previous = members;
    applyOptimisticRemove(item);
    setError(null);

    startTransition(async () => {
      const result = await withdrawPackageRunRosterMember({
        kind: row.kind,
        runId: row.id,
        userId: item.userId!,
        studentPackageId: isPersistedStudentPackageId(item.id) ? item.id : undefined,
        courseId: row.courseId,
      });

      if (result.error) {
        onRosterChange({ kind: row.kind, id: row.id }, (current) => {
          const field = rosterFieldForStatus(status);
          return {
            ...current,
            [field]: previous,
          };
        });
        setError(result.error);
      }
    });
  }

  const selected = members.map(memberToPickerItem);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPopover}
        className="block w-full rounded-lg text-left hover:bg-violet-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {members.length === 0 ? (
          <span className="px-1 py-0.5 text-xs font-medium text-violet-600">Add</span>
        ) : (
          <div className="flex flex-wrap gap-1 p-0.5">
            {members.slice(0, 4).map((member) => (
              <span
                key={member.studentPackageId}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                title={member.email ?? member.label}
              >
                {member.label}
              </span>
            ))}
            {members.length > 4 && (
              <span className="text-xs font-medium text-zinc-500">+{members.length - 4}</span>
            )}
          </div>
        )}
      </button>

      <RelationPickerPopover
        open={open}
        anchorRef={triggerRef}
        onClose={() => setOpen(false)}
        selected={selected}
        excludedUserIds={allRosterUserIds(row)}
        onAdd={handleAdd}
        onRemove={handleRemove}
        pending={pending}
        error={error}
      />
    </>
  );
}
