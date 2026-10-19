"use client";

import { fetchLatestCleanupRun, type CleanupRunSummary } from "@/app/admin/cleanup/actions";
import { useEffect, useState } from "react";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

export function AdminCleanupSweepPanel() {
  const [run, setRun] = useState<CleanupRunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchLatestCleanupRun().then((result) => {
      if (cancelled) return;
      setRun(result.run);
      setError(result.error ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-[12px] border-[0.5px] border-zinc-200 bg-white px-4 py-4">
      <h2 className="font-heading text-[17px] font-semibold text-zinc-900">File cleanup</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Nightly sweep of voice notes and photos that no longer belong to an account. Nothing to do here.
      </p>
      {error ? <p className="mt-3 text-sm text-amber-800">{error}</p> : null}
      {!loaded ? <p className="mt-3 text-sm text-zinc-500">Loading the last sweep.</p> : null}
      {loaded && !error && !run ? <p className="mt-3 text-sm text-zinc-500">No sweep yet.</p> : null}
      {run ? (
        <dl className="mt-3 grid gap-2 text-sm text-zinc-800 sm:grid-cols-4">
          <div>
            <dt className="text-zinc-500">When</dt>
            <dd>
              {formatWhen(run.finishedAt ?? run.startedAt)} UK
              {run.dryRun ? " · dry run" : ""}
              {run.status === "failed" ? " · failed" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Files found</dt>
            <dd>{run.filesFound}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Files deleted</dt>
            <dd>{run.filesDeleted}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Errors</dt>
            <dd>{run.errorCount}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
