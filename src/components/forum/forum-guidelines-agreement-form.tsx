"use client";

import { useActionState } from "react";
import {
  agreeToForumGuidelines,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { ForumGuidelinesContent } from "@/components/forum/forum-guidelines-content";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

const initial: ForumActionResult = {};

export function ForumGuidelinesAgreementForm() {
  const [state, formAction, pending] = useActionState(agreeToForumGuidelines, initial);

  return (
    <div className={ui.stackLoose}>
      <div className={ui.cardBordered}>
        <ForumGuidelinesContent />
      </div>

      <form action={formAction} className={ui.cardBordered}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="agree"
            required
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-zinc-700">
            I have read the community guidelines and agree to follow them when posting in the
            forum.
          </span>
        </label>

        {state.error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" disabled={pending} className={ui.btnPrimary}>
            {pending ? "Saving…" : "I agree — continue"}
          </button>
          <Link href="/dashboard/community/forum" className={ui.btnGhost}>
            Back to forum
          </Link>
        </div>
      </form>
    </div>
  );
}
