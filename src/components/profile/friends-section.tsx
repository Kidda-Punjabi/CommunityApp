"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import {
  removeFriend,
  respondFriendRequest,
  sendFriendRequestByCode,
  type ActionResult,
} from "@/app/dashboard/friends/actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import type {
  FriendListItem,
  FriendRequestItem,
} from "@/lib/friends/load-friends";
import { ui } from "@/lib/ui/styles";

const initial: ActionResult = {};

type FriendsSectionProps = {
  friends: FriendListItem[];
  requests: FriendRequestItem[];
  unavailable: boolean;
};

export function FriendsSection({ friends, requests, unavailable }: FriendsSectionProps) {
  const [addState, addAction, addPending] = useActionState(sendFriendRequestByCode, initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removePending, startRemove] = useTransition();
  const incoming = requests.filter((r) => r.direction === "incoming");

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

  if (unavailable) {
    return (
      <div className={ui.card}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Friends</p>
        <p className="mt-2 text-sm text-zinc-600">
          Run <code className="text-xs">supabase/friends-notifications.sql</code> in Supabase to
          enable friends.
        </p>
      </div>
    );
  }

  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Friends</p>
          <p className="mt-1 text-sm text-zinc-600">
            People you learn with. Referrals are added automatically.
          </p>
        </div>
        <Link href="/dashboard/friends" className="text-sm font-semibold text-violet-600">
          Manage
        </Link>
      </div>

      {incoming.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Friend requests ({incoming.length})
          </p>
          {incoming.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5"
            >
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
                <button
                  type="button"
                  disabled={pendingId === request.id}
                  onClick={() => void handleRespond(request.id, true)}
                  className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={pendingId === request.id}
                  onClick={() => void handleRespond(request.id, false)}
                  className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form action={addAction} className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Add a friend</p>
        <p className="text-xs text-zinc-500">Enter their invite code from Profile → Invite a friend.</p>
        <div className="flex gap-2">
          <input
            name="invite_code"
            type="text"
            placeholder="Invite code"
            className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
          <button
            type="submit"
            disabled={addPending}
            className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {addPending ? "…" : "Add"}
          </button>
        </div>
        {addState.error && <p className="text-sm text-red-600">{addState.error}</p>}
        {addState.success && <p className="text-sm text-green-700">{addState.success}</p>}
      </form>

      <div className="mt-5 border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your friends ({friends.length})
        </p>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No friends yet — add someone by invite code.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {friends.slice(0, 6).map((friend) => (
              <li
                key={friend.userId}
                className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5"
              >
                <UserAvatar
                  profile={{
                    full_name: friend.displayName,
                    preferred_name: null,
                    avatar_url: friend.avatarUrl,
                  }}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{friend.displayName}</p>
                  <p className="text-xs text-zinc-500">
                    {friend.source === "referral" ? "Joined via your invite" : "Friends"}
                    {friend.learnerLevel != null ? ` · Level ${friend.learnerLevel}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={removePending}
                  onClick={() => handleRemove(friend.userId)}
                  className="text-xs font-medium text-zinc-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {friends.length > 6 && (
          <Link href="/dashboard/friends" className="mt-2 inline-block text-sm font-medium text-violet-600">
            View all {friends.length} friends →
          </Link>
        )}
      </div>
    </div>
  );
}
