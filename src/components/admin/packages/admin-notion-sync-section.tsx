"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  deleteNotionTutorMapping,
  dismissNotionInboxRow,
  fetchLeadLinkAdminData,
  fetchLeadPurchaseGrantQueue,
  fetchNotionLinkFormOptions,
  fetchNotionTutorMapData,
  linkNotionInboxRow,
  refreshNotionLeadsCache,
  refreshNotionPackageInbox,
  resolveLeadPurchaseGrantQueueItemAction,
  saveNotionTutorMapping,
  searchNotionWorkspaceUsers,
} from "@/app/admin/packages/notion-actions";

type Tab = "inbox" | "tutors" | "leads" | "grants";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function AdminNotionSyncSection() {
  const [tab, setTab] = useState<Tab>("inbox");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inboxRows, setInboxRows] = useState<
    Awaited<ReturnType<typeof refreshNotionPackageInbox>>["rows"]
  >([]);
  const [tutorData, setTutorData] = useState<
    Awaited<ReturnType<typeof fetchNotionTutorMapData>>
  >({ tutors: [], mappings: [] });
  const [leadData, setLeadData] = useState<
    Awaited<ReturnType<typeof fetchLeadLinkAdminData>>
  >({ unlinkedProfiles: [], conflicts: [] });
  const [grantData, setGrantData] = useState<
    Awaited<ReturnType<typeof fetchLeadPurchaseGrantQueue>>
  >({ rows: [], cohorts: [], packageInstances: [] });
  const [grantSelections, setGrantSelections] = useState<
    Record<string, { kind: "cohort" | "package_instance"; runId: string }>
  >({});
  const [formOptions, setFormOptions] = useState<
    Awaited<ReturnType<typeof fetchNotionLinkFormOptions>>
  >({ packages: [] });

  const [packageOverrides, setPackageOverrides] = useState<Record<string, string>>({});
  const [tutorDraft, setTutorDraft] = useState({
    tutorId: "",
    notionUserId: "",
    notionUserName: "",
  });
  const [notionUserQuery, setNotionUserQuery] = useState("");
  const [notionUsers, setNotionUsers] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);

  function reload() {
    startTransition(async () => {
      setError(null);
      const [inbox, tutors, leads, grants, options] = await Promise.all([
        refreshNotionPackageInbox(),
        fetchNotionTutorMapData(),
        fetchLeadLinkAdminData(),
        fetchLeadPurchaseGrantQueue(),
        fetchNotionLinkFormOptions(),
      ]);
      if (inbox.error) setError(inbox.error);
      if (tutors.error) setError(tutors.error);
      if (grants.error) setError(grants.error);
      setInboxRows(inbox.rows);
      if (inbox.autoLinked > 0) {
        setMessage(
          `Auto-linked ${inbox.autoLinked} package${inbox.autoLinked === 1 ? "" : "s"} from Notion.`
        );
      }
      setTutorData(tutors);
      setLeadData(leads);
      setGrantData(grants);
      setFormOptions(options);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function handleImportInbox(inboxId: string, packageId: string, courseId: string) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await linkNotionInboxRow(inboxId, packageId, courseId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Imported.");
      reload();
    });
  }

  function handleDismissInbox(inboxId: string) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await dismissNotionInboxRow(inboxId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Dismissed.");
      reload();
    });
  }

  function handleSaveTutorMap() {
    if (!tutorDraft.tutorId || !tutorDraft.notionUserId.trim()) {
      setError("Choose a tutor and Notion user id.");
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await saveNotionTutorMapping(
        tutorDraft.tutorId,
        tutorDraft.notionUserId,
        tutorDraft.notionUserName || null
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setMessage(result.success ?? "Saved.");
      setTutorDraft({ tutorId: "", notionUserId: "", notionUserName: "" });
      reload();
    });
  }

  function handleSearchNotionUsers() {
    startTransition(async () => {
      const result = await searchNotionWorkspaceUsers(notionUserQuery);
      if (result.error) setError(result.error);
      setNotionUsers(result.users);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Notion sync</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Link Notion packages, tutors, and lead identities with the app.
          </p>
        </div>
        <Link href="/admin/packages" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Back to packages
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["inbox", "Package inbox"],
            ["tutors", "Tutor map"],
            ["leads", "Lead links"],
            ["grants", "Purchase grants"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === id ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {label}
            {id === "grants" && grantData.rows.length > 0
              ? ` (${grantData.rows.length})`
              : ""}
          </button>
        ))}
      </div>

      {message && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {tab === "inbox" && (
        <section className="space-y-4">
          <p className="text-sm text-zinc-600">
            New Notion packages are matched to a catalog product and course automatically from the
            package title and Notion properties (Course, Delivery Type). Group cohorts are imported
            into the app as cohorts; 1-1 packages become package instances. Confirmed and interested
            people are read from Notion lead relations only — nothing is written back to Notion.
          </p>
          {inboxRows.length === 0 ? (
            <p className="text-sm text-zinc-500">No unresolved inbox rows — everything is linked.</p>
          ) : (
            inboxRows.map((row) => {
              const matchedPackage = formOptions.packages.find(
                (pkg) => pkg.name === row.resolvedPackageName
              );
              const selectedPackageId = packageOverrides[row.id] ?? matchedPackage?.id ?? "";
              const selectedPackage = formOptions.packages.find((pkg) => pkg.id === selectedPackageId);

              return (
                <div key={row.id} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-medium text-zinc-900">
                        {row.packageName ?? "Untitled package"}
                      </h2>
                      <p className="mt-1 text-xs text-zinc-500">Notion page {row.notionPageId}</p>
                      <p className="mt-2 text-sm text-zinc-600">
                        {formatDate(row.startDate)} → {formatDate(row.endDate)} ·{" "}
                        {row.status ?? "No status"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handleDismissInbox(row.id)}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      Dismiss — not a real package
                    </button>
                  </div>

                  {row.skipReason && (
                    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {row.skipReason}
                    </p>
                  )}

                  {!row.skipReason && row.resolvedPackageName && row.resolvedCourseName && (
                    <div className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                      <p>
                        <span className="font-medium text-zinc-900">Course:</span>{" "}
                        {row.resolvedCourseName}
                      </p>
                      <p className="mt-1">
                        <span className="font-medium text-zinc-900">Package product:</span>{" "}
                        {row.resolvedPackageName}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Could not import automatically — use the override below if needed.
                      </p>
                    </div>
                  )}

                  {(row.skipReason || row.resolvedPackageName) && (
                    <div className="mt-4">
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                          Package product
                        </span>
                        <select
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                          value={selectedPackageId}
                          onChange={(event) =>
                            setPackageOverrides((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select package…</option>
                          {formOptions.packages.map((pkg) => (
                            <option key={pkg.id} value={pkg.id}>
                              {pkg.name} ({pkg.courseName})
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedPackage && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              handleImportInbox(row.id, selectedPackage.id, selectedPackage.courseId)
                            }
                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
                          >
                            Import with override
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      {tab === "tutors" && (
        <section className="space-y-6">
          <div className="rounded-xl border border-zinc-200 p-4">
            <h2 className="font-medium text-zinc-900">Add or update mapping</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  App tutor
                </span>
                <select
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                  value={tutorDraft.tutorId}
                  onChange={(event) =>
                    setTutorDraft((current) => ({ ...current, tutorId: event.target.value }))
                  }
                >
                  <option value="">Select tutor…</option>
                  {tutorData.tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Notion user id
                </span>
                <input
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2"
                  value={tutorDraft.notionUserId}
                  onChange={(event) =>
                    setTutorDraft((current) => ({ ...current, notionUserId: event.target.value }))
                  }
                  placeholder="Paste Notion user id"
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                value={notionUserQuery}
                onChange={(event) => setNotionUserQuery(event.target.value)}
                placeholder="Search Notion workspace users"
              />
              <button
                type="button"
                disabled={pending}
                onClick={handleSearchNotionUsers}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
              >
                Search
              </button>
            </div>
            {notionUsers.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {notionUsers.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      className="text-left text-violet-600 hover:text-violet-500"
                      onClick={() =>
                        setTutorDraft((current) => ({
                          ...current,
                          notionUserId: user.id,
                          notionUserName: user.name,
                        }))
                      }
                    >
                      {user.name} <span className="text-zinc-400">({user.id})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={handleSaveTutorMap}
              className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              Save mapping
            </button>
          </div>

          <div>
            <h2 className="font-medium text-zinc-900">Current mappings</h2>
            {tutorData.mappings.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No tutor mappings yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {tutorData.mappings.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-zinc-900">{row.tutorName}</p>
                      <p className="text-zinc-500">
                        {row.notionUserName ?? row.notionUserId}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await deleteNotionTutorMapping(row.id);
                          if (result.error) setError(result.error);
                          else reload();
                        })
                      }
                      className="text-red-600 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "leads" && (
        <section className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-zinc-200 p-4">
            <div>
              <h2 className="font-medium text-zinc-900">Leads cache</h2>
              <p className="mt-1 max-w-xl text-sm text-zinc-600">
                Contact fields used by Packages people lists, sales calls, and lead search.
                Cron refreshes every 10 minutes (leads first); use full sync after bulk Notion edits.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    setMessage(null);
                    setError(null);
                    const result = await refreshNotionLeadsCache(false);
                    if (result.error) setError(result.error);
                    else setMessage(result.success ?? "Synced.");
                    reload();
                  });
                }}
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? "Working…" : "Sync from Notion"}
              </button>
              <button
                type="button"
                disabled={pending}
                title="Re-pull every Leads page (use after bulk contact fixes)"
                onClick={() => {
                  startTransition(async () => {
                    setMessage(null);
                    setError(null);
                    const result = await refreshNotionLeadsCache(true);
                    if (result.error) setError(result.error);
                    else setMessage(result.success ?? "Full sync done.");
                    reload();
                  });
                }}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60"
              >
                Full sync
              </button>
            </div>
          </div>

          <div>
            <h2 className="font-medium text-zinc-900">Unlinked app users</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Profiles with no matching Notion lead page yet. Informational only — automatic
              email matching runs every 10 minutes and on signup.
            </p>
            {leadData.unlinkedProfiles.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No unlinked profiles in the latest batch.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {leadData.unlinkedProfiles.map((profile) => (
                  <li key={profile.id} className="px-4 py-3 text-sm">
                    <p className="font-medium text-zinc-900">{profile.label}</p>
                    <p className="text-zinc-500">{profile.email ?? "No email"}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-medium text-zinc-900">Link conflicts</h2>
            {leadData.conflicts.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No conflicts logged.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {leadData.conflicts.map((conflict) => (
                  <li key={conflict.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                    <p className="font-medium text-amber-950">{conflict.profileLabel}</p>
                    <p className="mt-1 text-amber-900">{conflict.leadEmail ?? "Unknown email"}</p>
                    <p className="mt-2 text-amber-800">
                      Existing lead page: {conflict.existingNotionPageId}
                    </p>
                    <p className="text-amber-800">
                      Attempted lead page: {conflict.attemptedNotionPageId}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === "grants" && (
        <section className="space-y-4">
          <p className="text-sm text-zinc-600">
            After signup lead-link, Packages that could not be auto-granted (multiple packages or no
            matching cohort/instance) land here. Grant the right run in one click, or dismiss.
          </p>
          {grantData.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No pending purchase grants.</p>
          ) : (
            grantData.rows.map((row) => {
              const selection = grantSelections[row.id] ?? {
                kind: "cohort" as const,
                runId: grantData.cohorts[0]?.id ?? "",
              };
              const resolved = Array.isArray(
                (row.rawPackageData as { resolved?: unknown }).resolved
              )
                ? (
                    row.rawPackageData as {
                      resolved: Array<{ kind: string; runId: string; label: string }>;
                    }
                  ).resolved
                : [];

              return (
                <div key={row.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                  <h2 className="font-medium text-zinc-900">
                    {row.leadName ?? "Unknown lead"} · {row.leadEmail ?? "No email"}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Reason: {row.reason} · Lead page {row.notionLeadPageId}
                  </p>
                  {resolved.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                      {resolved.map((item) => (
                        <li key={`${item.kind}-${item.runId}`}>
                          Suggested: {item.kind} — {item.label}
                          <button
                            type="button"
                            className="ml-2 text-violet-700 underline"
                            onClick={() =>
                              setGrantSelections((prev) => ({
                                ...prev,
                                [row.id]: {
                                  kind: item.kind as "cohort" | "package_instance",
                                  runId: item.runId,
                                },
                              }))
                            }
                          >
                            Use
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <label className="text-sm text-zinc-700">
                      Kind
                      <select
                        className="mt-1 block rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                        value={selection.kind}
                        onChange={(e) =>
                          setGrantSelections((prev) => ({
                            ...prev,
                            [row.id]: {
                              kind: e.target.value as "cohort" | "package_instance",
                              runId: "",
                            },
                          }))
                        }
                      >
                        <option value="cohort">Cohort</option>
                        <option value="package_instance">1-1 instance</option>
                      </select>
                    </label>
                    <label className="text-sm text-zinc-700">
                      Run
                      <select
                        className="mt-1 block min-w-[14rem] rounded-lg border border-zinc-200 bg-white px-2 py-1.5"
                        value={selection.runId}
                        onChange={(e) =>
                          setGrantSelections((prev) => ({
                            ...prev,
                            [row.id]: { ...selection, runId: e.target.value },
                          }))
                        }
                      >
                        <option value="">Select…</option>
                        {(selection.kind === "cohort"
                          ? grantData.cohorts
                          : grantData.packageInstances
                        ).map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={pending || !selection.runId}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                      onClick={() => {
                        startTransition(async () => {
                          setError(null);
                          setMessage(null);
                          const result = await resolveLeadPurchaseGrantQueueItemAction(
                            row.id,
                            "grant",
                            {
                              kind: selection.kind,
                              runId: selection.runId,
                            }
                          );
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          setMessage(result.success ?? "Granted.");
                          reload();
                        });
                      }}
                    >
                      Grant access
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-60"
                      onClick={() => {
                        startTransition(async () => {
                          setError(null);
                          setMessage(null);
                          const result = await resolveLeadPurchaseGrantQueueItemAction(
                            row.id,
                            "dismiss"
                          );
                          if (result.error) {
                            setError(result.error);
                            return;
                          }
                          setMessage(result.success ?? "Dismissed.");
                          reload();
                        });
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
