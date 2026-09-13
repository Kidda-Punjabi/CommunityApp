"use client";

import { issueKidLevelCertificate } from "@/app/dashboard/tutor/actions";
import type { KidLevelCertificateCandidate } from "@/lib/learn/kid-level-certificate";
import { ui } from "@/lib/ui/styles";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function stageLabel(stage: KidLevelCertificateCandidate["certificateStage"]): string {
  if (stage === "beginner") return "Beginner";
  if (stage === "intermediate") return "Intermediate";
  return "Advanced";
}

export function KidLevelCertificatePanel({
  kids,
}: {
  kids: KidLevelCertificateCandidate[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const [, startTransition] = useTransition();

  if (kids.length === 0) return null;

  async function handleIssue(kid: KidLevelCertificateCandidate) {
    setMessage({});
    setPendingId(kid.enrollmentId);
    const result = await issueKidLevelCertificate(kid.enrollmentId);
    setPendingId(null);
    setConfirmId(null);
    setMessage(result);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className={`${ui.cardBordered} mb-6`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Kid certificates
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        Mark a level complete to issue a certificate and move the child to the next level.
      </p>

      {message.error ? (
        <p className="mt-3 text-sm text-rose-600">{message.error}</p>
      ) : null}
      {message.success ? (
        <p className="mt-3 text-sm text-emerald-700">{message.success}</p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {kids.map((kid) => {
          const confirming = confirmId === kid.enrollmentId;
          const pending = pendingId === kid.enrollmentId;
          const stage = stageLabel(kid.certificateStage);

          return (
            <li
              key={kid.enrollmentId}
              className="rounded-2xl border border-zinc-100 bg-zinc-50/70 px-4 py-3"
            >
              <p className="font-semibold text-zinc-900">{kid.kidName}</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {stage} · Level {kid.levelNumber}
                {kid.alreadyIssued ? " · certificate issued for this level" : ""}
              </p>

              {kid.alreadyIssued ? null : confirming ? (
                <div className="mt-3">
                  <p className="text-sm text-zinc-700">
                    Issue a {stage} Level {kid.levelNumber} certificate for {kid.kidName}
                    {kid.levelNumber >= 3
                      ? "? They’ll stay on Level 3 — Intermediate is not a course yet."
                      : ` and move them to Level ${kid.levelNumber + 1}?`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleIssue(kid)}
                      className={ui.btnPrimary}
                    >
                      {pending ? "Issuing…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmId(null)}
                      className={ui.btnSecondary}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pendingId != null}
                  onClick={() => {
                    setMessage({});
                    setConfirmId(kid.enrollmentId);
                  }}
                  className={`${ui.btnSecondary} mt-3`}
                >
                  Mark Level {kid.levelNumber} complete
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
