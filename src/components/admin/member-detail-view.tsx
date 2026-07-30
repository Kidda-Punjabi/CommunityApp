"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { AdminData } from "@/app/admin/content/types";
import {
  loadAdminMemberDetail,
  saveMemberBeginnersSetup,
  saveMemberCommunityAccess,
  saveMemberExtraRescheduleAllowance,
  saveMemberFoundationalSetup,
} from "@/app/admin/content/member-actions";
import { APP_ROLE_LABELS, type AppRole } from "@/lib/auth/admin-access";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  inputClass,
  labelClass,
} from "@/app/admin/content/components/ui";

type MemberDetailViewProps = {
  userId: string;
  data: AdminData;
  onUpdated?: () => void;
};

export function MemberDetailView({ userId, data, onUpdated }: MemberDetailViewProps) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof loadAdminMemberDetail>>["detail"]>(
    null
  );
  const [detailError, setDetailError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [detailPending, startDetailTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();

  const [foundationalAccess, setFoundationalAccess] = useState(false);
  const [foundationalTutorId, setFoundationalTutorId] = useState("");
  const [beginnersAccess, setBeginnersAccess] = useState(false);
  const [beginnersTutorId, setBeginnersTutorId] = useState("");
  const [beginnersDelivery, setBeginnersDelivery] = useState<"" | "one_to_one" | "group">("");
  const [beginnersCohortId, setBeginnersCohortId] = useState("");
  const [communityAccess, setCommunityAccess] = useState(false);
  const [extraRescheduleAllowance, setExtraRescheduleAllowance] = useState(0);

  const assignableStaff = useMemo(
    () => data.staffMembers.filter((member) => member.appRoles.length > 0),
    [data.staffMembers]
  );

  useEffect(() => {
    startDetailTransition(async () => {
      setDetailError(null);
      const response = await loadAdminMemberDetail(userId);
      if (response.error || !response.detail) {
        setDetailError(response.error ?? "Member not found.");
        setDetail(null);
        return;
      }
      setDetail(response.detail);
    });
  }, [userId]);

  useEffect(() => {
    if (!detail) return;

    setFoundationalAccess(detail.courseAccess.foundational);
    setFoundationalTutorId(detail.foundationalEnrollment?.tutorId ?? "");
    setBeginnersAccess(detail.courseAccess.beginners);
    setBeginnersTutorId(detail.beginnersEnrollment?.tutorId ?? "");
    setBeginnersDelivery(detail.beginnersEnrollment?.deliveryMode ?? "");
    setBeginnersCohortId(detail.beginnersEnrollment?.cohortId ?? "");
    setCommunityAccess(detail.courseAccess.community);
    setExtraRescheduleAllowance(detail.beginnersEnrollment?.extraRescheduleAllowance ?? 0);
    setMessage({});
  }, [detail]);

  async function refreshDetail() {
    const refreshed = await loadAdminMemberDetail(userId);
    if (refreshed.detail) setDetail(refreshed.detail);
    onUpdated?.();
  }

  function saveFoundational() {
    if (!detail?.courseIds.foundational) return;
    startSaveTransition(async () => {
      const result = await saveMemberFoundationalSetup(
        detail.userId,
        detail.courseIds.foundational!,
        foundationalAccess,
        foundationalTutorId || null
      );
      setMessage(result);
      if (!result.error) await refreshDetail();
    });
  }

  function saveBeginners() {
    if (!detail?.courseIds.beginners) return;
    startSaveTransition(async () => {
      const result = await saveMemberBeginnersSetup(
        detail.userId,
        detail.courseIds.beginners!,
        beginnersAccess,
        beginnersTutorId || null,
        beginnersDelivery,
        beginnersCohortId || null
      );
      setMessage(result);
      if (!result.error) await refreshDetail();
    });
  }

  function saveCommunity() {
    if (!detail?.courseIds.community) return;
    startSaveTransition(async () => {
      const result = await saveMemberCommunityAccess(
        detail.userId,
        detail.courseIds.community!,
        communityAccess
      );
      setMessage(result);
      if (!result.error) await refreshDetail();
    });
  }

  function saveRescheduleAllowance() {
    if (!detail?.courseIds.beginners) return;
    startSaveTransition(async () => {
      const result = await saveMemberExtraRescheduleAllowance(
        detail.userId,
        detail.courseIds.beginners!,
        extraRescheduleAllowance
      );
      setMessage(result);
      if (!result.error) await refreshDetail();
    });
  }

  if (detailPending) {
    return (
      <SectionCard title="Member details">
        <p className="text-sm text-zinc-500">Loading member…</p>
      </SectionCard>
    );
  }

  if (detailError || !detail) {
    return (
      <SectionCard title="Member details">
        <p className="text-sm text-red-600">{detailError ?? "Could not load member."}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard title={detail.displayName}>
        <div className="flex items-center gap-4">
          <UserAvatar
            profile={{
              full_name: detail.displayName,
              preferred_name: null,
              avatar_url: detail.avatarUrl,
            }}
            size="md"
          />
          <div>
            {detail.email && <p className="text-sm text-zinc-600">{detail.email}</p>}
            <p className="mt-1 text-xs text-zinc-500">
              Membership:{" "}
              <span className="font-semibold capitalize text-zinc-800">
                {detail.membershipTier}
              </span>
              {detail.subscriptionStatus
                ? ` · subscription ${detail.subscriptionStatus}`
                : ""}
            </p>
            {detail.activeCohorts.length > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                Cohorts: {detail.activeCohorts.map((cohort) => cohort.cohortName).join(", ")}
              </p>
            )}
          </div>
        </div>
        <FormMessage state={message} />
      </SectionCard>

      <SectionCard title="Foundational course">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={foundationalAccess}
            onChange={(event) => setFoundationalAccess(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-violet-600"
          />
          <span className="text-sm font-medium text-zinc-900">Has course access</span>
        </label>
        <div className="mt-4">
          <label htmlFor="fd_tutor" className={labelClass}>
            Tutor (1-1)
          </label>
          <select
            id="fd_tutor"
            value={foundationalTutorId}
            onChange={(event) => setFoundationalTutorId(event.target.value)}
            className={inputClass}
          >
            <option value="">No tutor assigned</option>
            {assignableStaff.map((staff) => (
              <option key={staff.userId} value={staff.userId}>
                {staff.displayName} —{" "}
                {staff.appRoles.map((role) => APP_ROLE_LABELS[role as AppRole] ?? role).join(", ")}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={savePending || !detail.courseIds.foundational}
          onClick={saveFoundational}
          className={`mt-4 ${buttonClass}`}
        >
          {savePending ? "Saving…" : "Save foundational"}
        </button>
      </SectionCard>

      <SectionCard title="Beginners course">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={beginnersAccess}
            onChange={(event) => setBeginnersAccess(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-violet-600"
          />
          <span className="text-sm font-medium text-zinc-900">Has course access</span>
        </label>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="bc_delivery" className={labelClass}>
              Delivery mode
            </label>
            <select
              id="bc_delivery"
              value={beginnersDelivery}
              onChange={(event) => {
                setBeginnersDelivery(event.target.value as "" | "one_to_one" | "group");
                setBeginnersCohortId("");
              }}
              className={inputClass}
            >
              <option value="">Select…</option>
              <option value="one_to_one">1-1</option>
              <option value="group">Group cohort</option>
            </select>
          </div>

          {beginnersDelivery === "group" && (
            <div>
              <label htmlFor="bc_cohort" className={labelClass}>
                Cohort
              </label>
              <select
                id="bc_cohort"
                value={beginnersCohortId}
                onChange={(event) => setBeginnersCohortId(event.target.value)}
                className={inputClass}
              >
                <option value="">Select cohort…</option>
                {data.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-500">
                Student will be added to the cohort automatically when you save.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="bc_tutor" className={labelClass}>
              Tutor
            </label>
            <select
              id="bc_tutor"
              value={beginnersTutorId}
              onChange={(event) => setBeginnersTutorId(event.target.value)}
              className={inputClass}
            >
              <option value="">No tutor assigned</option>
              {assignableStaff.map((staff) => (
                <option key={staff.userId} value={staff.userId}>
                  {staff.displayName} —{" "}
                  {staff.appRoles.map((role) => APP_ROLE_LABELS[role as AppRole] ?? role).join(", ")}
                </option>
              ))}
            </select>
          </div>
        </div>

        {detail.beginnersEnrollment ? (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
            <p className="text-sm font-medium text-zinc-900">Reschedule allowance</p>
            <p className="mt-1 text-xs text-zinc-600">
              {detail.beginnersEnrollment.deliveryMode === "group" ? (
                <>
                  Group alternate-cohort requests: used{" "}
                  {detail.beginnersEnrollment.groupReschedule.used} of{" "}
                  {detail.beginnersEnrollment.groupReschedule.totalAllowed} (default limit is 2).
                  Pending and approved requests count toward this total.
                </>
              ) : (
                <>
                  1-to-1 reschedules: used {detail.beginnersEnrollment.oneToOneReschedule.used} of{" "}
                  {detail.beginnersEnrollment.oneToOneReschedule.totalAllowed} (default limit is 2).
                  Pending and approved requests count toward this total.
                </>
              )}
            </p>
            <div className="mt-3">
              <label htmlFor="bc_extra_reschedules" className={labelClass}>
                Extra reschedule allowance (admin override)
              </label>
              <input
                id="bc_extra_reschedules"
                type="number"
                min={0}
                step={1}
                value={extraRescheduleAllowance}
                onChange={(event) =>
                  setExtraRescheduleAllowance(Math.max(0, Number(event.target.value) || 0))
                }
                className={inputClass}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Add extra{" "}
                {detail.beginnersEnrollment.deliveryMode === "group"
                  ? "alternate cohort requests"
                  : "1-to-1 reschedules"}{" "}
                beyond the default 2 if you need to allow another change.
              </p>
            </div>
            <button
              type="button"
              disabled={savePending}
              onClick={saveRescheduleAllowance}
              className={`mt-3 ${buttonClass}`}
            >
              {savePending ? "Saving…" : "Save reschedule allowance"}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          disabled={savePending || !detail.courseIds.beginners}
          onClick={saveBeginners}
          className={`mt-4 ${buttonClass}`}
        >
          {savePending ? "Saving…" : "Save beginners"}
        </button>
      </SectionCard>

      <SectionCard title="Community">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={communityAccess}
            onChange={(event) => setCommunityAccess(event.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-violet-600"
          />
          <span className="text-sm font-medium text-zinc-900">Has course access</span>
        </label>
        <p className="mt-2 text-xs text-zinc-500">
          Community does not use tutor assignments — access unlocks all community lessons.
        </p>
        <button
          type="button"
          disabled={savePending || !detail.courseIds.community}
          onClick={saveCommunity}
          className={`mt-4 ${buttonClass}`}
        >
          {savePending ? "Saving…" : "Save community access"}
        </button>
      </SectionCard>
    </div>
  );
}
