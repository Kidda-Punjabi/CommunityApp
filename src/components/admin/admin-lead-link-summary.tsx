"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchLeadLinkAdminData } from "@/app/admin/packages/notion-actions";

export function AdminLeadLinkSummary() {
  const [unlinkedCount, setUnlinkedCount] = useState<number | null>(null);
  const [conflictCount, setConflictCount] = useState<number | null>(null);

  useEffect(() => {
    void fetchLeadLinkAdminData().then((data) => {
      setUnlinkedCount(data.unlinkedProfiles.length);
      setConflictCount(data.conflicts.length);
    });
  }, []);

  return (
    <div className="mb-6 rounded-2xl border border-zinc-200/80 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Notion lead links</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Automatic email matching links app users to Leads Database rows.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Unlinked profiles shown: {unlinkedCount ?? "…"} · Conflicts: {conflictCount ?? "…"}
          </p>
        </div>
        <Link
          href="/admin/packages/notion"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          View details
        </Link>
      </div>
    </div>
  );
}
