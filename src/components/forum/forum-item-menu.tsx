"use client";

import { useEffect, useState, useTransition } from "react";
import {
  blockForumUser,
  deleteForumPost,
  deleteForumReply,
  reportForumContent,
  type ForumActionResult,
} from "@/app/dashboard/community/forum/actions";
import { FORUM_REPORT_REASONS, type ForumReportReason } from "@/lib/forum/safety";

const initial: ForumActionResult = {};

type ForumItemMenuProps = {
  targetType: "post" | "reply";
  targetId: string;
  postId: string;
  authorId: string;
  authorName: string;
  viewerUserId: string;
  isMasterAdmin?: boolean;
};

export function ForumItemMenu({
  targetType,
  targetId,
  postId,
  authorId,
  authorName,
  viewerUserId,
  isMasterAdmin = false,
}: ForumItemMenuProps) {
  const own = authorId === viewerUserId;
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reason, setReason] = useState<ForumReportReason | "">("");
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (own && !isMasterAdmin) return null;

  function submitReport() {
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    const formData = new FormData();
    formData.set("reason", reason);
    formData.set("details", details);
    startTransition(async () => {
      const result = await reportForumContent(targetType, targetId, initial, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.reportId) {
        await fetch("/api/forum-reports/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: result.reportId }),
        });
      }
      setReportOpen(false);
      setOpen(false);
      setMessage(result.success ?? "Report submitted.");
      window.setTimeout(() => window.location.reload(), 1600);
    });
  }

  function confirmBlockUser() {
    startTransition(async () => {
      const result = await blockForumUser(authorId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmBlock(false);
      setOpen(false);
      window.location.reload();
    });
  }

  function removeItem() {
    if (!window.confirm("Remove this from the forum?")) return;
    startTransition(async () => {
      const result =
        targetType === "post"
          ? await deleteForumPost(targetId)
          : await deleteForumReply(targetId, postId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More actions"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
        }}
        className="rounded-full px-2 py-1 text-lg leading-none text-zinc-500 hover:bg-zinc-100"
      >
        …
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-2xl border border-zinc-200 bg-white p-1 shadow-lg">
          {!own ? (
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
              onClick={() => {
                setOpen(false);
                setReportOpen(true);
                setError(null);
              }}
            >
              Report
            </button>
          ) : null}
          {!own ? (
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-50"
              onClick={() => {
                setConfirmBlock(true);
                setError(null);
              }}
            >
              Block {authorName}
            </button>
          ) : null}
          {isMasterAdmin ? (
            <button
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              onClick={removeItem}
            >
              Remove
            </button>
          ) : null}
        </div>
      ) : null}
      {confirmBlock ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl">
            <p className="text-sm text-zinc-800">
              Block {authorName}? Their posts and replies will disappear from your forum.
            </p>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={confirmBlockUser}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Block
              </button>
              <button type="button" onClick={() => setConfirmBlock(false)} className="text-sm text-zinc-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {reportOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">Report</h2>
            <div className="mt-3 space-y-2">
              {FORUM_REPORT_REASONS.map((item) => (
                <label key={item.id} className="flex items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="radio"
                    name="report-reason"
                    checked={reason === item.id}
                    onChange={() => setReason(item.id)}
                  />
                  {item.label}
                </label>
              ))}
            </div>
            {reason === "other" ? (
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value.slice(0, 500))}
                required
                rows={3}
                placeholder="Tell us what happened"
                className="mt-3 w-full rounded-2xl border border-zinc-200 px-3 py-2 text-sm"
              />
            ) : null}
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={submitReport}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? "Sending…" : "Submit report"}
              </button>
              <button type="button" onClick={() => setReportOpen(false)} className="text-sm text-zinc-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
