"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchUnresolvedEnrollments,
  resolveUnresolvedEnrollment,
  type UnresolvedEnrollmentAction,
} from "@/app/admin/unresolved-enrollments/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { notionPageHref } from "@/lib/admin/enrollment-gaps-types";
import {
  PACKAGE_INSTANCE_STATUSES,
  packageStatusLabel,
  packageStatusPillTone,
  type PackageInstanceStatus,
} from "@/lib/admin/package-status";
import {
  closeEnrollmentIsHeld,
  UNRESOLVED_CATEGORY_LABELS,
  type UnresolvedEnrollmentAccount,
  type UnresolvedEnrollmentCategory,
  type UnresolvedEnrollmentRow,
} from "@/lib/admin/unresolved-enrollments/types";
import { getPublicAppUrl } from "@/lib/app-url";
import { ui } from "@/lib/ui/styles";

const CATEGORIES: UnresolvedEnrollmentCategory[] = ["A", "B", "C", "D", "E", "G", "H"];

function statusView(status: string): { label: string; tone: "amber" | "violet" | "green" | "zinc" } {
  if ((PACKAGE_INSTANCE_STATUSES as readonly string[]).includes(status)) {
    const known = status as PackageInstanceStatus;
    return { label: packageStatusLabel(known), tone: packageStatusPillTone(known) };
  }
  return { label: status, tone: "zinc" };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function AccountCard({ label, account }: { label: string; account: UnresolvedEnrollmentAccount }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-medium text-zinc-900">{account.full_name ?? "Unnamed"}</p>
      <p className="text-xs text-zinc-600">{account.email ?? "No email"}</p>
      <p className="text-xs text-zinc-500">Created {formatDateTime(account.created_at)}</p>
      <p className="text-xs text-zinc-500">Enrolled in: {account.enrolled_in ?? "Nothing active"}</p>
    </div>
  );
}

export function AdminUnresolvedEnrollmentsSection() {
  const [rows, setRows] = useState<UnresolvedEnrollmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<UnresolvedEnrollmentCategory | "all">("all");
  const [targetId, setTargetId] = useState<string>("all");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchUnresolvedEnrollments().then((result) => {
      if (cancelled) return;
      setRows(result.rows);
      setError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const targets = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of rows) seen.set(row.target_id, row.target_name);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const counts = useMemo(() => {
    const next = Object.fromEntries(CATEGORIES.map((item) => [item, 0])) as Record<
      UnresolvedEnrollmentCategory,
      number
    >;
    for (const row of rows) next[row.category] += 1;
    return next;
  }, [rows]);

  const visible = rows.filter((row) => {
    if (category !== "all" && row.category !== category) return false;
    if (targetId !== "all" && row.target_id !== targetId) return false;
    return true;
  });

  async function run(row: UnresolvedEnrollmentRow, action: UnresolvedEnrollmentAction) {
    if (action === "remove_member") {
      const confirmed = window.confirm(
        `Remove ${row.person_name} from ${row.target_name}? This sets their membership as left.`
      );
      if (!confirmed) return;
    }
    if (action === "dismiss" || action === "not_using_app") {
      const note = (notes[row.row_key] ?? "").trim();
      if (!note) {
        setRowErrors((current) => ({ ...current, [row.row_key]: "A note is required." }));
        return;
      }
    }

    setPendingKey(row.row_key);
    setRowErrors((current) => {
      const next = { ...current };
      delete next[row.row_key];
      return next;
    });
    const result = await resolveUnresolvedEnrollment({
      action,
      targetKind: row.target_kind,
      targetId: row.target_id,
      userId: row.user_id,
      notionLeadPageId: row.notion_lead_page_id,
      notionPackagePageId: row.notion_package_page_id,
      kidProfileId: row.kid_profile_id,
      note: (notes[row.row_key] ?? "").trim() || null,
    });
    setPendingKey(null);
    if (result.error) {
      setRowErrors((current) => ({ ...current, [row.row_key]: result.error ?? "That action failed." }));
      return;
    }
    setRows((current) => current.filter((entry) => entry.row_key !== row.row_key));
  }

  async function copySignup(row: UnresolvedEnrollmentRow) {
    const link = `${getPublicAppUrl()}/signup`;
    await navigator.clipboard.writeText(link);
    setCopiedKey(row.row_key);
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Admin home
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Unresolved enrollments</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-500">
          Active recruiting, scheduled, in-progress, and paused cohorts and package instances.
          One row per person. Dismissed rows stay off this list.
        </p>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <AdminFilterPill label={`All ${rows.length}`} active={category === "all"} onClick={() => setCategory("all")} />
        {CATEGORIES.map((item) => (
          <AdminFilterPill
            key={item}
            label={`${item} ${counts[item]} · ${UNRESOLVED_CATEGORY_LABELS[item]}`}
            active={category === item}
            onClick={() => setCategory(item)}
          />
        ))}
      </div>

      <label className="mb-6 block max-w-sm text-sm text-zinc-600">
        Cohort or package
        <select
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="all">All</option>
          {targets.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visible.length === 0 ? (
        <div className={ui.emptyState}>
          <p className="text-lg font-semibold text-zinc-900">Nothing in this filter</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white">
          <table className="min-w-[64rem] text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-3 py-3">Where</th>
                <th className="px-3 py-3">Issue</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {visible.map((row) => {
                const pending = pendingKey === row.row_key;
                const held = closeEnrollmentIsHeld(row);
                const notionLead = row.notion_lead_page_id ? notionPageHref(row.notion_lead_page_id) : null;
                return (
                  <tr key={row.row_key} className="align-top hover:bg-zinc-50/50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-zinc-900">{row.person_name}</p>
                      <p className="text-xs text-zinc-500">{row.email ?? "No email"}</p>
                      {row.user_id ? (
                        <Link
                          href={`/admin/content/people/members/${row.user_id}`}
                          className="mt-1 inline-block text-xs font-medium text-violet-600 hover:text-violet-500"
                        >
                          Open profile
                        </Link>
                      ) : null}
                      {notionLead ? (
                        <a
                          href={notionLead}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-xs font-medium text-violet-600 hover:text-violet-500"
                        >
                          Open in Notion
                        </a>
                      ) : null}
                      {row.kids && row.kids.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                          {row.kids.map((kid) => (
                            <li key={kid.name}>
                              {kid.name}
                              {kid.active ? "" : " (left)"}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {row.duplicate_accounts ? (
                        <div className="mt-3 grid gap-2">
                          <AccountCard label="This account" account={row.duplicate_accounts.this} />
                          <AccountCard label="Already on this cohort" account={row.duplicate_accounts.other} />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-zinc-900">{row.target_name}</p>
                      <AdminStatusPill tone={statusView(row.target_status).tone}>
                        {statusView(row.target_status).label}
                      </AdminStatusPill>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">
                      <p className="font-medium text-zinc-800">
                        {row.category} · {UNRESOLVED_CATEGORY_LABELS[row.category]}
                      </p>
                      <p className="mt-1">{row.detail}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-2">
                        {row.category === "A" ? (
                          <button type="button" className={ui.btnPrimary} disabled={pending} onClick={() => void run(row, "enroll")}>
                            Enroll now
                          </button>
                        ) : null}
                        {row.category === "B" ? (
                          <button type="button" className={ui.btnPrimary} disabled={pending} onClick={() => void run(row, "link_and_enroll")}>
                            Link account & enroll
                          </button>
                        ) : null}
                        {row.category === "C" ? (
                          <>
                            <button type="button" className={ui.btnSecondary} disabled={pending} onClick={() => void copySignup(row)}>
                              {copiedKey === row.row_key ? "Signup link copied" : "Copy signup link"}
                            </button>
                            <button type="button" className={ui.btnSecondary} disabled={pending} onClick={() => void run(row, "not_using_app")}>
                              Mark not using app
                            </button>
                          </>
                        ) : null}
                        {row.category === "D" && !held ? (
                          <button type="button" className={ui.btnPrimary} disabled={pending} onClick={() => void run(row, "repair")}>
                            Repair
                          </button>
                        ) : null}
                        {row.category === "E" ? (
                          <>
                            <button type="button" className={ui.btnPrimary} disabled={pending} onClick={() => void run(row, "add_to_notion")}>
                              Add to Notion Confirmed
                            </button>
                            <button type="button" className={ui.btnSecondary} disabled={pending} onClick={() => void run(row, "remove_member")}>
                              Remove from cohort
                            </button>
                          </>
                        ) : null}
                        {row.category === "G" && row.duplicate_accounts ? (
                          <>
                            <button type="button" className={ui.btnSecondary} disabled={pending} onClick={() => void run(row, "merge")}>
                              Merge: keep this one
                            </button>
                            <button type="button" className={ui.btnSecondary} disabled={pending} onClick={() => void run(row, "merge")}>
                              Merge: keep the other one
                            </button>
                          </>
                        ) : null}
                        <textarea
                          rows={2}
                          value={notes[row.row_key] ?? ""}
                          onChange={(event) =>
                            setNotes((current) => ({ ...current, [row.row_key]: event.target.value }))
                          }
                          placeholder="Note (required to dismiss)"
                          className="w-56 rounded-xl border border-zinc-200 px-3 py-2 text-xs text-zinc-900"
                        />
                        <button type="button" className={ui.btnSecondary} disabled={pending} onClick={() => void run(row, "dismiss")}>
                          Dismiss
                        </button>
                        {rowErrors[row.row_key] ? (
                          <p className="max-w-xs text-xs text-red-600">{rowErrors[row.row_key]}</p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
