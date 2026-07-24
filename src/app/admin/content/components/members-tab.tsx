"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import type { AdminData, AdminMemberListItem } from "@/app/admin/content/types";
import { listAdminMembers } from "@/app/admin/content/member-actions";
import { MemberDetailView } from "@/components/admin/member-detail-view";
import { UserAvatar } from "@/components/profile/user-avatar";
import { SectionCard, inputClass, secondaryButtonClass } from "@/app/admin/content/components/ui";

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

function memberRowClass(selected: boolean) {
  return `flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
    selected
      ? "border-violet-300 bg-violet-50"
      : "border-zinc-200 bg-white hover:border-violet-200 hover:bg-violet-50/50"
  }`;
}

function MemberListContent({
  member,
  selected,
  onSelect,
}: {
  member: AdminMemberListItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const inner = (
    <>
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
        {member.email && <p className="truncate text-xs text-zinc-500">{member.email}</p>}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {member.membershipTier === "premium" ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
              Premium
              {member.subscriptionStatus ? ` · ${member.subscriptionStatus}` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
              {member.membershipTier}
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <AccessBadges tiers={member.accessTiers} />
        </div>
      </div>
    </>
  );

  return (
    <>
      <Link
        href={`/admin/content/people/members/${member.userId}`}
        className={`lg:hidden ${memberRowClass(selected)}`}
      >
        {inner}
      </Link>
      <button type="button" onClick={onSelect} className={`hidden lg:flex ${memberRowClass(selected)}`}>
        {inner}
      </button>
    </>
  );
}

type MembersTabProps = {
  data: AdminData;
};

export function MembersTab({ data }: MembersTabProps) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<AdminMemberListItem[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listPending, startListTransition] = useTransition();
  const [listVersion, setListVersion] = useState(0);

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

  function selectMember(member: AdminMemberListItem) {
    setSelectedId(member.userId);
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

        <ul className="mt-4 max-h-[32rem] space-y-2 overflow-y-auto lg:max-h-none">
          {members.length === 0 && !listPending ? (
            <li className="text-sm text-zinc-500">No members found.</li>
          ) : (
            members.map((member) => (
              <li key={member.userId}>
                <MemberListContent
                  member={member}
                  selected={selectedId === member.userId}
                  onSelect={() => selectMember(member)}
                />
              </li>
            ))
          )}
        </ul>
      </SectionCard>

      <div className="hidden lg:block">
        {!selectedId ? (
          <SectionCard title="Member details">
            <p className="text-sm text-zinc-500">Select a member to manage their courses.</p>
          </SectionCard>
        ) : (
          <>
            <MemberDetailView
              key={`${selectedId}-${listVersion}`}
              userId={selectedId}
              data={data}
              onUpdated={() => {
                loadMembers(query);
                setListVersion((v) => v + 1);
              }}
            />
            <button
              type="button"
              className={`mt-4 ${secondaryButtonClass}`}
              onClick={() => setSelectedId(null)}
            >
              Clear selection
            </button>
          </>
        )}
      </div>
    </div>
  );
}
