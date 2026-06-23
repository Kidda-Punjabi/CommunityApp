"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  sendKudos,
} from "@/app/dashboard/notifications/actions";
import { respondFriendRequest } from "@/app/dashboard/friends/actions";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { NotificationItem } from "@/lib/notifications/load-notifications";
import { notificationSummary } from "@/lib/notifications/load-notifications";
import { ui } from "@/lib/ui/styles";

type NotificationsListProps = {
  notifications: NotificationItem[];
};

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function notificationHref(item: NotificationItem): string | null {
  const challengeId = item.payload.challenge_id;
  if (typeof challengeId === "string") {
    if (item.type === "friend_game_challenge") {
      return `/dashboard/challenges/${challengeId}/play`;
    }

    if (item.type === "friend_game_challenge_result") {
      return `/dashboard/challenges/${challengeId}`;
    }
  }

  if (item.type === "homework_reviewed") {
    const lessonId = item.payload.lesson_id;
    const tier = item.payload.course_tier;
    const track =
      tier === "beginners" || tier === "foundational" ? tier : "foundational";
    if (typeof lessonId === "string") {
      return `/dashboard/learn/${track}#lesson-${lessonId}`;
    }
    return "/dashboard/learn";
  }

  return null;
}

export function NotificationsList({ notifications }: NotificationsListProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(() => new Set());
  const [handledRequests, setHandledRequests] = useState<
    Record<string, "accepted" | "declined">
  >({});

  function isRead(item: NotificationItem): boolean {
    return Boolean(item.readAt) || locallyReadIds.has(item.id);
  }

  function refresh() {
    router.refresh();
  }

  function friendRequestOutcome(
    item: NotificationItem
  ): "pending" | "accepted" | "declined" | null {
    const requestId =
      typeof item.payload.request_id === "string" ? item.payload.request_id : null;
    if (!requestId) return null;

    const local = handledRequests[requestId];
    if (local) return local;

    if (item.friendRequestStatus === "accepted") return "accepted";
    if (item.friendRequestStatus === "declined") return "declined";
    if (item.friendRequestStatus === "pending") return "pending";

    return null;
  }

  async function markRead(notificationId: string): Promise<boolean> {
    if (locallyReadIds.has(notificationId)) return true;

    setLocallyReadIds((current) => new Set(current).add(notificationId));

    const result = await markNotificationRead(notificationId);
    if (result.error) {
      setLocallyReadIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
      setActionError(result.error);
      return false;
    }

    return true;
  }

  async function handleNotificationClick(item: NotificationItem) {
    setActionError(null);
    const marked = await markRead(item.id);
    if (!marked) return;

    const href = notificationHref(item);
    if (href) {
      router.push(href);
      return;
    }

    refresh();
  }

  async function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      setLocallyReadIds(new Set(notifications.map((item) => item.id)));
      refresh();
    });
  }

  async function handleKudos(id: string) {
    setActionError(null);
    startTransition(async () => {
      await markRead(id);
      const result = await sendKudos(id);
      if (result.error) setActionError(result.error);
      refresh();
    });
  }

  async function handleFriendRequest(
    notificationId: string,
    requestId: string,
    accept: boolean
  ) {
    setActionError(null);
    setPendingRequestId(requestId);
    startTransition(async () => {
      const result = await respondFriendRequest(requestId, accept);
      setPendingRequestId(null);

      if (result.error) {
        setActionError(result.error);
        return;
      }

      setHandledRequests((prev) => ({
        ...prev,
        [requestId]: accept ? "accepted" : "declined",
      }));
      await markRead(notificationId);
      refresh();
    });
  }

  async function handleLinkClick(
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NotificationItem,
    href: string
  ) {
    event.preventDefault();
    setActionError(null);
    const marked = await markRead(item.id);
    if (marked) router.push(href);
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/home" className="text-sm font-medium text-violet-600">
            ← Home
          </Link>
          <h1 className="mt-3 text-2xl font-bold text-zinc-900">Notifications</h1>
        </div>
        {notifications.some((n) => !isRead(n)) && (
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleMarkAll()}
            className="text-sm font-semibold text-violet-600 hover:text-violet-500 disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>

      <Link
        href="/dashboard/profile/notifications"
        className="text-sm font-medium text-zinc-500 hover:text-violet-600"
      >
        Notification settings →
      </Link>

      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {notifications.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-sm text-zinc-500">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((item) => {
            const href = notificationHref(item);
            const read = isRead(item);

            return (
              <li
                key={item.id}
                className={`rounded-2xl border px-4 py-3 ${
                  read ? "border-zinc-100 bg-white" : "border-violet-100 bg-violet-50/50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void handleNotificationClick(item)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <UserAvatar
                    profile={{
                      full_name: item.actorDisplayName,
                      preferred_name: null,
                      avatar_url: item.actorAvatarUrl,
                    }}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">
                      {notificationSummary(item)}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">{formatWhen(item.createdAt)}</p>
                    {item.type === "announcement" && typeof item.payload.body === "string" && (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                        {item.payload.body}
                      </p>
                    )}
                  </div>
                  {!read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-600" />
                  )}
                </button>

                {item.type === "friend_level_up" && !item.kudosSent && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void handleKudos(item.id)}
                    className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Send kudos 🎉
                  </button>
                )}

                {item.type === "friend_level_up" && item.kudosSent && (
                  <p className="mt-2 text-xs font-medium text-emerald-700">Kudos sent!</p>
                )}

                {item.type === "friend_request" &&
                  typeof item.payload.request_id === "string" &&
                  (() => {
                    const requestId = item.payload.request_id as string;
                    const outcome = friendRequestOutcome(item);

                    if (outcome === "accepted") {
                      return (
                        <p className="mt-2 text-xs font-medium text-emerald-700">
                          Friend request accepted — you&apos;re now friends!
                        </p>
                      );
                    }

                    if (outcome === "declined") {
                      return (
                        <p className="mt-2 text-xs font-medium text-zinc-500">Request declined.</p>
                      );
                    }

                    if (outcome !== "pending") return null;

                    return (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={pending || pendingRequestId === requestId}
                          onClick={() =>
                            void handleFriendRequest(item.id, requestId, true)
                          }
                          className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={pending || pendingRequestId === requestId}
                          onClick={() =>
                            void handleFriendRequest(item.id, requestId, false)
                          }
                          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    );
                  })()}

                {item.type === "friend_game_challenge" && href && (
                  <Link
                    href={href}
                    onClick={(event) => void handleLinkClick(event, item, href)}
                    className="mt-3 block w-full rounded-lg bg-violet-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-violet-500"
                  >
                    Play challenge
                  </Link>
                )}

                {item.type === "friend_game_challenge_result" && href && (
                  <Link
                    href={href}
                    onClick={(event) => void handleLinkClick(event, item, href)}
                    className="mt-3 block w-full rounded-lg border border-violet-200 px-3 py-2 text-center text-sm font-semibold text-violet-700 hover:bg-violet-50"
                  >
                    View result
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
