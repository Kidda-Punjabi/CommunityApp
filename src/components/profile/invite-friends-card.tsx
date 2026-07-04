"use client";

import { referralStatusLabel } from "@/lib/referrals/constants";
import type {
  ReferralListItem,
  ReferralUnavailableReason,
} from "@/lib/referrals/load-referrals";
import { CopyButton, type CopyButtonHandle } from "@/components/ui/copy-button";
import { ui } from "@/lib/ui/styles";
import { useRef, useState } from "react";

type InviteFriendsCardProps = {
  shareUrl: string | null;
  referralCode: string | null;
  referrals: ReferralListItem[];
  unavailableReason?: ReferralUnavailableReason;
};

function unavailableMessage(reason: ReferralUnavailableReason | undefined): string {
  if (reason === "migration_required") {
    return "Referrals are not set up on this database yet. Run supabase/referrals.sql in the Supabase SQL Editor for the project linked to this app.";
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

function statusBadgeClass(status: ReferralListItem["status"]): string {
  return status === "qualified"
    ? "bg-emerald-50 text-emerald-700"
    : "bg-amber-50 text-amber-700";
}

export function InviteFriendsCard({
  shareUrl,
  referralCode,
  referrals,
  unavailableReason,
}: InviteFriendsCardProps) {
  const copyButtonRef = useRef<CopyButtonHandle>(null);
  const [shareError, setShareError] = useState<string | null>(null);

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
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    const copied = await copyButtonRef.current?.copy();
    if (copied === false) {
      setShareError("Could not copy — try selecting the link manually.");
    }
  }

  return (
    <div className={ui.card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            Invite a friend
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            Share your link so friends can join Kidda. You&apos;ll see their status here.
          </p>
        </div>
        <span className="text-3xl" aria-hidden="true">
          🤝
        </span>
      </div>

      <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your invite link
        </p>
        {shareUrl ? (
          <>
            <p className="mt-2 break-all text-sm font-medium text-zinc-800">{shareUrl}</p>
            {referralCode && (
              <p className="mt-2 text-xs text-zinc-500">Code: {referralCode}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">{unavailableMessage(unavailableReason)}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <CopyButton
          ref={copyButtonRef}
          text={shareUrl ?? ""}
          disabled={!shareUrl}
          onCopySuccess={() => setShareError(null)}
          onCopyError={() =>
            setShareError("Could not copy — try selecting the link manually.")
          }
        >
          Copy link
        </CopyButton>
        <button
          type="button"
          onClick={shareLink}
          disabled={!shareUrl}
          className={ui.btnPrimary}
        >
          Share link
        </button>
      </div>

      {shareError && (
        <p className="mt-3 text-sm text-red-600">{shareError}</p>
      )}

      <div className="mt-6 border-t border-zinc-100 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your referrals
        </p>

        {referrals.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No referrals yet — share your link to invite friends.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {referrals.map((referral) => (
              <li
                key={referral.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">
                    {referral.referredDisplayName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Joined {formatReferralDate(referral.signedUpAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(referral.status)}`}
                >
                  {referralStatusLabel(referral.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
