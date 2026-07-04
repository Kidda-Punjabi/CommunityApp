"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import {
  removeFriend,
  respondFriendRequest,
  sendFriendRequestByCode,
  type ActionResult,
} from "@/app/dashboard/friends/actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import { CopyButton, type CopyButtonHandle } from "@/components/ui/copy-button";
import {
  EyebrowLabel,
  HubCard,
  HubSecondaryButton,
  StatusBadge,
} from "@/components/ui/hub-primitives";
import { referralStatusLabel } from "@/lib/referrals/constants";
import type { ReferralListItem, ReferralUnavailableReason } from "@/lib/referrals/load-referrals";
import type { FriendListItem, FriendRequestItem } from "@/lib/friends/load-friends";
import { ui } from "@/lib/ui/styles";

const initial: ActionResult = {};

type FriendsDetailProps = {
  friends: FriendListItem[];
  requests: FriendRequestItem[];
  shareUrl: string | null;
  referralCode: string | null;
  referrals: ReferralListItem[];
  unavailableReason?: ReferralUnavailableReason;
  friendsUnavailable: boolean;
};

function unavailableMessage(reason: ReferralUnavailableReason | undefined): string {
  if (reason === "migration_required") {
    return "Referrals are not set up on this database yet.";
  }
  return "Your invite link is not ready yet. Refresh this page in a moment.";
}

function formatReferralDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

type CombinedPerson = {
  key: string;
  name: string;
  avatarUrl: string | null;
  learnerLevel: number | null;
  badge: string;
  badgeVariant: "success" | "neutral";
  kind: "friend" | "referral" | "request";
  userId?: string;
  requestId?: string;
};

export function FriendsDetail({
  friends,
  requests,
  shareUrl,
  referralCode,
  referrals,
  unavailableReason,
  friendsUnavailable,
}: FriendsDetailProps) {
  const [addState, addAction, addPending] = useActionState(sendFriendRequestByCode, initial);
  const [showAddForm, setShowAddForm] = useState(false);
  const copyButtonRef = useRef<CopyButtonHandle>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removePending, startRemove] = useTransition();

  const incoming = requests.filter((request) => request.direction === "incoming");

  const friendNames = new Set(friends.map((friend) => friend.displayName.toLowerCase()));

  const combinedPeople: CombinedPerson[] = [
    ...friends.map((friend) => ({
      key: `friend-${friend.userId}`,
      name: friend.displayName,
      avatarUrl: friend.avatarUrl,
      learnerLevel: friend.learnerLevel,
      badge:
        friend.learnerLevel != null
          ? `Level ${friend.learnerLevel}`
          : friend.source === "referral"
            ? "Active"
            : "Active",
      badgeVariant: "success" as const,
      kind: "friend" as const,
      userId: friend.userId,
    })),
    ...referrals
      .filter((referral) => !friendNames.has(referral.referredDisplayName.toLowerCase()))
      .map((referral) => ({
        key: `referral-${referral.id}`,
        name: referral.referredDisplayName,
        avatarUrl: null,
        learnerLevel: null,
        badge:
          referral.status === "qualified"
            ? referralStatusLabel(referral.status)
            : `Joined ${formatReferralDate(referral.signedUpAt)}`,
        badgeVariant: (referral.status === "qualified" ? "success" : "neutral") as
          | "success"
          | "neutral",
        kind: "referral" as const,
      })),
  ];

  async function shareLink() {
    if (!shareUrl) return;
    setShareError(null);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join me on Kidda",
          text: "Learn Punjabi with me on Kidda.",
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    const copied = await copyButtonRef.current?.copy();
    if (copied === false) {
      setShareError("Could not copy — try selecting the link manually.");
    }
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setPendingId(requestId);
    await respondFriendRequest(requestId, accept);
    setPendingId(null);
  }

  function handleRemove(friendUserId: string) {
    if (!window.confirm("Remove this friend?")) return;
    startRemove(async () => {
      await removeFriend(friendUserId);
    });
  }

  if (friendsUnavailable) {
    return (
      <div className={ui.page}>
        <BackLink fallbackHref="/dashboard/profile">← Back</BackLink>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Friends</h1>
        <HubCard className="mt-6">
          <p className="text-sm text-zinc-600">
            Run <code className="text-xs">supabase/friends-notifications.sql</code> in Supabase to
            enable friends.
          </p>
        </HubCard>
      </div>
    );
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <BackLink fallbackHref="/dashboard/profile">← Back</BackLink>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Friends</h1>
      </div>

      <HubCard>
        <EyebrowLabel>Invite link</EyebrowLabel>
        {shareUrl ? (
          <>
            <p className="mt-2 break-all text-sm text-zinc-800">{shareUrl}</p>
            {referralCode ? (
              <p className="mt-1 text-xs text-zinc-500">Code: {referralCode}</p>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{unavailableMessage(unavailableReason)}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <CopyButton
            ref={copyButtonRef}
            variant="hub"
            text={shareUrl ?? ""}
            disabled={!shareUrl}
            onCopySuccess={() => setShareError(null)}
            onCopyError={() =>
              setShareError("Could not copy — try selecting the link manually.")
            }
          >
            Copy link
          </CopyButton>
          <HubSecondaryButton onClick={shareLink} disabled={!shareUrl}>
            Share link
          </HubSecondaryButton>
        </div>
        {shareError ? <p className="mt-3 text-sm text-red-600">{shareError}</p> : null}
      </HubCard>

      {incoming.length > 0 ? (
        <HubCard>
          <EyebrowLabel>Friend requests</EyebrowLabel>
          <ul className="mt-2 divide-y divide-zinc-100">
            {incoming.map((request) => (
              <li key={request.id} className="flex items-center gap-3 py-3">
                <UserAvatar
                  profile={{
                    full_name: request.otherDisplayName,
                    preferred_name: null,
                    avatar_url: request.otherAvatarUrl,
                  }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">
                    {request.otherDisplayName}
                  </p>
                  <p className="text-xs text-zinc-500">Wants to be friends</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <HubSecondaryButton
                    className="px-2.5 py-1.5 text-xs"
                    disabled={pendingId === request.id}
                    onClick={() => void handleRespond(request.id, true)}
                  >
                    Accept
                  </HubSecondaryButton>
                  <HubSecondaryButton
                    className="px-2.5 py-1.5 text-xs"
                    disabled={pendingId === request.id}
                    onClick={() => void handleRespond(request.id, false)}
                  >
                    Decline
                  </HubSecondaryButton>
                </div>
              </li>
            ))}
          </ul>
        </HubCard>
      ) : null}

      <HubCard>
        <EyebrowLabel>People</EyebrowLabel>
        {combinedPeople.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No friends yet — share your invite link.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100">
            {combinedPeople.map((person) => (
              <li key={person.key} className="flex items-center gap-3 py-3">
                <UserAvatar
                  profile={{
                    full_name: person.name,
                    preferred_name: null,
                    avatar_url: person.avatarUrl,
                  }}
                  level={person.learnerLevel}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{person.name}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge variant={person.badgeVariant}>{person.badge}</StatusBadge>
                  {person.kind === "friend" && person.userId ? (
                    <button
                      type="button"
                      disabled={removePending}
                      onClick={() => handleRemove(person.userId!)}
                      className="text-xs font-medium text-zinc-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-zinc-100 pt-4">
          {!showAddForm ? (
            <HubSecondaryButton onClick={() => setShowAddForm(true)}>Add a friend</HubSecondaryButton>
          ) : (
            <form action={addAction} className="space-y-2">
              <p className="text-sm text-zinc-600">Enter their invite code.</p>
              <div className="flex gap-2">
                <input
                  name="invite_code"
                  type="text"
                  placeholder="Invite code"
                  className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                />
                <HubSecondaryButton type="submit" disabled={addPending}>
                  {addPending ? "…" : "Send"}
                </HubSecondaryButton>
              </div>
              {addState.error ? <p className="text-sm text-red-600">{addState.error}</p> : null}
              {addState.success ? <p className="text-sm text-green-700">{addState.success}</p> : null}
            </form>
          )}
        </div>
      </HubCard>

      {friends.length > 0 ? (
        <Link
          href="/dashboard/challenges/new"
          className="inline-flex w-full items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          Challenge a friend
        </Link>
      ) : null}
    </div>
  );
}
