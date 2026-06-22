"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { AdminData, AdminMemberDetail, AdminMemberListItem } from "../types";
import {
  loadAdminMemberDetail,
  listAdminMembers,
  saveMemberBeginnersSetup,
  saveMemberCommunityAccess,
  saveMemberFoundationalSetup,
} from "../member-actions";
import {
  APP_ROLE_LABELS,
  ASSIGNABLE_STAFF_ROLES,
  type AppRole,
} from "@/lib/auth/admin-access";
import { UserAvatar } from "@/components/profile/user-avatar";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

type MembersTabProps = {
  data: AdminData;
};

const TIER_LABELS: Record<string, string> = {
  foundational: "Foundational",
  beginners: "Beginners",
  community: "Community",
};

function AccessBadges({ tiers }: { tiers: string[] }) {
  if (tiers.length === 0) {
    return <span className="text-xs text-zinc-400">No paid courses</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tiers.map((tier) => (
        <span
          key={tier}
          className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800"
        >
          {TIER_LABELS[tier] ?? tier}
        </span>
      ))}
    </div>
  );
}

export function MembersTab({ data }: MembersTabProps) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<AdminMemberListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [listPending, startListTransition] = useTransition();
  const [detailPending, startDetailTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();

  const [foundationalAccess, setFoundationalAccess] = useState(false);
  const [foundationalTutorId, setFoundationalTutorId] = useState("");

  const [beginnersAccess, setBeginnersAccess] = useState(false);
  const [beginnersTutorId, setBeginnersTutorId] = useState("");
  const [beginnersDelivery, setBeginnersDelivery] = useState<"" | "one_to_one" | "group">("");
  const [beginnersCohortId, setBeginnersCohortId] = useState("");

  const [communityAccess, setCommunityAccess] = useState(false);

  const assignableStaff = useMemo(
    () => data.staffMembers.filter((member) => member.appRoles.length > 0),
    [data.staffMembers]
  );

  const loadMembers = useCallback((search: string) => {
    startListTransition(async () => {
      setListError(null);
      const response = await listAdminMembers(search, 1);
      if (response.error) {
        setListError(response.error);
        setMembers([]);
        return;
      }
      setMembers(response.members);
    });
  }, []);

  useEffect(() => {
    loadMembers("");
  }, [loadMembers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMembers(query);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, loadMembers]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    startDetailTransition(async () => {
      setDetailError(null);
      const response = await loadAdminMemberDetail(selectedId);
      if (response.error || !response.detail) {
        setDetailError(response.error ?? "Member not found.");
        setDetail(null);
        return;
      }
      setDetail(response.detail);
    });
  }, [selectedId]);

  useEffect(() => {
    if (!detail) return;

    setFoundationalAccess(detail.courseAccess.foundational);
    setFoundationalTutorId(detail.foundationalEnrollment?.tutorId ?? "");

    setBeginnersAccess(detail.courseAccess.beginners);
    setBeginnersTutorId(detail.beginnersEnrollment?.tutorId ?? "");
    setBeginnersDelivery(detail.beginnersEnrollment?.deliveryMode ?? "");
    setBeginnersCohortId(detail.beginnersEnrollment?.cohortId ?? "");

    setCommunityAccess(detail.courseAccess.community);
    setMessage({});
  }, [detail]);

  function selectMember(member: AdminMemberListItem) {
    setSelectedId(member.userId);
    setMessage({});
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
      if (!result.error) {
        loadMembers(query);
        const refreshed = await loadAdminMemberDetail(detail.userId);
        if (refreshed.detail) setDetail(refreshed.detail);
      }
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
      if (!result.error) {
        loadMembers(query);
        const refreshed = await loadAdminMemberDetail(detail.userId);
        if (refreshed.detail) setDetail(refreshed.detail);
      }
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
      if (!result.error) {
        loadMembers(query);
        const refreshed = await loadAdminMemberDetail(detail.userId);
        if (refreshed.detail) setDetail(refreshed.detail);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <SectionCard title="Members">
        <p className="mb-4 text-sm text-zinc-600">
          Browse members and manage course access, tutors, and beginners delivery.
        </p>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email…"
          className={inputClass}
        />
        {listPending && <p className="mt-3 text-sm text-zinc-500">Loading members…</p>}
        {listError && <p className="mt-3 text-sm text-red-600">{listError}</p>}

        <ul className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto">
          {members.length === 0 && !listPending ? (
            <li className="text-sm text-zinc-500">No members found.</li>
          ) : (
            members.map((member) => (
              <li key={member.userId}>
                <button
                  type="button"
                  onClick={() => selectMember(member)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                    selectedId === member.userId
                      ? "border-violet-300 bg-violet-50"
                      : "border-zinc-200 bg-white hover:border-violet-200 hover:bg-violet-50/50"
                  }`}
                >
                  <UserAvatar
                    profile={{
                      full_name: member.displayName,
                      preferred_name: null,
                      avatar_url: member.avatarUrl,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900">{member.displayName}</p>
                    {member.email && (
                      <p className="truncate text-xs text-zinc-500">{member.email}</p>
                    )}
                    <div className="mt-1.5">
                      <AccessBadges tiers={member.accessTiers} />
                    </div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </SectionCard>

      <div>
        {!selectedId ? (
          <SectionCard title="Member details">
            <p className="text-sm text-zinc-500">Select a member to manage their courses.</p>
          </SectionCard>
        ) : detailPending ? (
          <SectionCard title="Member details">
            <p className="text-sm text-zinc-500">Loading member…</p>
          </SectionCard>
        ) : detailError || !detail ? (
          <SectionCard title="Member details">
            <p className="text-sm text-red-600">{detailError ?? "Could not load member."}</p>
          </SectionCard>
        ) : (
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
                  {detail.activeCohorts.length > 0 && (
                    <p className="mt-1 text-xs text-zinc-500">
                      Cohorts:{" "}
                      {detail.activeCohorts.map((cohort) => cohort.cohortName).join(", ")}
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
                      {staff.appRoles
                        .map((role) => APP_ROLE_LABELS[role as AppRole] ?? role)
                        .join(", ")}
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
                      setBeginnersDelivery(
                        event.target.value as "" | "one_to_one" | "group"
                      );
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
                        {staff.appRoles
                          .map((role) => APP_ROLE_LABELS[role as AppRole] ?? role)
                          .join(", ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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

            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setSelectedId(null)}
            >
              Clear selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
