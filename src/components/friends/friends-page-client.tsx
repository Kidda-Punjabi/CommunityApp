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

type FriendsPageClientProps = {
  friends: FriendListItem[];
  requests: FriendRequestItem[];
};

export function FriendsPageClient({ friends, requests }: FriendsPageClientProps) {
  const [addState, addAction, addPending] = useActionState(sendFriendRequestByCode, initial);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [removePending, startRemove] = useTransition();
  const incoming = requests.filter((r) => r.direction === "incoming");
  const outgoing = requests.filter((r) => r.direction === "outgoing");

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

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <Link href="/dashboard/friends" className="text-sm font-medium text-violet-600">
          ← Profile
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">Friends</h1>
          <Link
            href="/dashboard/challenges/new"
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Challenge a friend
          </Link>
        </div>
      </div>

      {(incoming.length > 0 || outgoing.length > 0) && (
        <div className={ui.card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Friend requests
          </p>
          <div className="mt-3 space-y-2">
            {incoming.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                pending={pendingId === request.id}
                onRespond={handleRespond}
              />
            ))}
            {outgoing.map((request) => (
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
                  <p className="text-xs text-zinc-500">Request pending</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={ui.card}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Add a friend</p>
        <p className="mt-1 text-sm text-zinc-600">
          Ask for their invite code from Profile → Invite a friend.
        </p>
        <form action={addAction} className="mt-3 flex gap-2">
          <input
            name="invite_code"
            type="text"
            placeholder="Invite code"
            className="flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
          <button
            type="submit"
            disabled={addPending}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Send request
          </button>
        </form>
        {addState.error && <p className="mt-2 text-sm text-red-600">{addState.error}</p>}
        {addState.success && <p className="mt-2 text-sm text-green-700">{addState.success}</p>}
      </div>

      <div className={ui.card}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          All friends ({friends.length})
        </p>
        {friends.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No friends yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {friends.map((friend) => (
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
                  level={friend.learnerLevel}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{friend.displayName}</p>
                  <p className="text-xs text-zinc-500">
                    {friend.source === "referral" ? "Via your invite · " : ""}
                    {friend.learnerLevel != null ? `Level ${friend.learnerLevel}` : "Member"}
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
      </div>
    </div>
  );
}

function RequestRow({
  request,
  pending,
  onRespond,
}: {
  request: FriendRequestItem;
  pending: boolean;
  onRespond: (id: string, accept: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5">
      <UserAvatar
        profile={{
          full_name: request.otherDisplayName,
          preferred_name: null,
          avatar_url: request.otherAvatarUrl,
        }}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{request.otherDisplayName}</p>
        <p className="text-xs text-zinc-500">Wants to be friends</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => onRespond(request.id, true)}
          className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onRespond(request.id, false)}
          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
