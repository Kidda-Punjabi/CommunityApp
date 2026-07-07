"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  deletePackagesSavedView,
  fetchAdminPackagesList,
  fetchPackagesSavedViews,
  savePackagesView,
} from "@/app/admin/packages/actions";
import { AdminFilterPill, AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { PackageRunFormModal } from "@/components/admin/packages/package-run-form-modal";
import type {
  AdminPackageListRow,
  AdminSavedView,
  PackagesViewConfig,
} from "@/lib/admin/packages/types";
import { DEFAULT_PACKAGES_VIEW_CONFIG } from "@/lib/admin/packages/types";
import {
  PACKAGE_DELIVERY_FORMATS,
  PACKAGE_INSTANCE_STATUSES,
  comparePackageDeliveryFormats,
  packageDeliveryFormat,
  packageDeliveryFormatLabel,
  packageDeliveryFormatPillTone,
  packageStatusLabel,
  packageStatusPillTone,
  type PackageDeliveryFormat,
} from "@/lib/admin/package-status";
import { ui } from "@/lib/ui/styles";
import { useEffect } from "react";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function RosterChips({
  members,
  packageId,
  roster,
}: {
  members: AdminPackageListRow["interested"];
  packageId: string;
  roster: "interested" | "confirmed";
}) {
  const href = `/admin/packages/${packageId}?roster=${roster}`;

  if (members.length === 0) {
    return (
      <Link href={href} className="text-xs font-medium text-violet-600 hover:text-violet-500">
        Add →
      </Link>
    );
  }

  return (
    <Link href={href} className="block rounded-lg hover:bg-violet-50/80">
      <div className="flex flex-wrap gap-1 p-0.5">
        {members.slice(0, 4).map((member) => (
          <span
            key={member.studentPackageId}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
            title={member.email ?? member.label}
          >
            {member.label}
          </span>
        ))}
        {members.length > 4 && (
          <span className="text-xs font-medium text-zinc-500">+{members.length - 4}</span>
        )}
      </div>
    </Link>
  );
}

function applyViewConfig(
  rows: AdminPackageListRow[],
  config: PackagesViewConfig
): AdminPackageListRow[] {
  let filtered = rows;

  const q = config.search.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((row) => row.name.toLowerCase().includes(q));
  }

  if (config.filters.status.length > 0) {
    filtered = filtered.filter((row) => config.filters.status.includes(row.status));
  }
  if (config.filters.tutorIds.length > 0) {
    filtered = filtered.filter(
      (row) => row.tutorId && config.filters.tutorIds.includes(row.tutorId)
    );
  }
  if (config.filters.courseIds.length > 0) {
    filtered = filtered.filter((row) => config.filters.courseIds.includes(row.courseId));
  }
  if (config.filters.deliveryModes.length > 0) {
    filtered = filtered.filter((row) =>
      config.filters.deliveryModes.includes(packageDeliveryFormat(row))
    );
  }

  filtered = [...filtered].sort((a, b) => {
    if (config.sort.field === "format") {
      const cmp = comparePackageDeliveryFormats(
        packageDeliveryFormat(a),
        packageDeliveryFormat(b)
      );
      if (cmp !== 0) {
        return config.sort.direction === "asc" ? cmp : -cmp;
      }
      return a.name.localeCompare(b.name);
    }
    if (config.sort.field === "name") {
      const cmp = a.name.localeCompare(b.name);
      return config.sort.direction === "asc" ? cmp : -cmp;
    }
    const aDate = a.startDate ?? "";
    const bDate = b.startDate ?? "";
    const cmp = aDate.localeCompare(bDate);
    return config.sort.direction === "asc" ? cmp : -cmp;
  });

  return filtered;
}

const GROUP_BY_OPTIONS: Array<{
  value: PackagesViewConfig["groupBy"];
  label: string;
}> = [
  { value: "none", label: "None" },
  { value: "status", label: "Status" },
  { value: "tutor", label: "Tutor" },
  { value: "course", label: "Course" },
  { value: "format", label: "Format" },
];

function cycleGroupBy(current: PackagesViewConfig["groupBy"]): PackagesViewConfig["groupBy"] {
  const index = GROUP_BY_OPTIONS.findIndex((option) => option.value === current);
  return GROUP_BY_OPTIONS[(index + 1) % GROUP_BY_OPTIONS.length].value;
}

function groupByPillLabel(groupBy: PackagesViewConfig["groupBy"]): string {
  if (groupBy === "none") return "Group";
  const option = GROUP_BY_OPTIONS.find((entry) => entry.value === groupBy);
  return `Group: ${option?.label ?? groupBy}`;
}

function groupRows(
  rows: AdminPackageListRow[],
  groupBy: PackagesViewConfig["groupBy"]
): Array<{ key: string; label: string; rows: AdminPackageListRow[] }> {
  if (groupBy === "none") {
    return [{ key: "all", label: "All packages", rows }];
  }

  const courseNameById = new Map<string, string>();
  const map = new Map<string, AdminPackageListRow[]>();
  for (const row of rows) {
    courseNameById.set(row.courseId, row.courseName);
    const key =
      groupBy === "status"
        ? row.status
        : groupBy === "course"
          ? row.courseId
          : groupBy === "format"
            ? packageDeliveryFormat(row)
            : row.tutorName ?? "Unassigned";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const groups = [...map.entries()].map(([key, groupRows]) => ({
    key,
    label:
      groupBy === "status"
        ? packageStatusLabel(key as AdminPackageListRow["status"])
        : groupBy === "course"
          ? courseNameById.get(key) ?? "Course"
          : groupBy === "format"
            ? packageDeliveryFormatLabel(key as PackageDeliveryFormat)
            : key,
    rows: groupRows,
  }));

  if (groupBy === "course" || groupBy === "tutor") {
    groups.sort((a, b) => a.label.localeCompare(b.label));
  }
  if (groupBy === "format") {
    groups.sort((a, b) =>
      comparePackageDeliveryFormats(a.key as PackageDeliveryFormat, b.key as PackageDeliveryFormat)
    );
  }

  return groups;
}

export function AdminPackagesSection() {
  const [rows, setRows] = useState<AdminPackageListRow[]>([]);
  const [savedViews, setSavedViews] = useState<AdminSavedView[]>([]);
  const [config, setConfig] = useState<PackagesViewConfig>(DEFAULT_PACKAGES_VIEW_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showTutorFilter, setShowTutorFilter] = useState(false);
  const [showFormatFilter, setShowFormatFilter] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingRow, setEditingRow] = useState<AdminPackageListRow | null>(null);

  async function reloadList() {
    const list = await fetchAdminPackagesList();
    setRows(list.rows);
    setError(list.error ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, views] = await Promise.all([
        fetchAdminPackagesList(),
        fetchPackagesSavedViews(),
      ]);
      if (cancelled) return;
      setRows(list.rows);
      setError(list.error ?? null);
      setSavedViews(views.views);
      setViewsError(views.error ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tutors = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.tutorId && row.tutorName) map.set(row.tutorId, row.tutorName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => applyViewConfig(rows, config), [rows, config]);
  const grouped = useMemo(() => groupRows(filteredRows, config.groupBy), [filteredRows, config.groupBy]);

  function resetFilters() {
    setConfig(DEFAULT_PACKAGES_VIEW_CONFIG);
  }

  function cycleGroupBySetting() {
    setConfig((current) => ({
      ...current,
      groupBy: cycleGroupBy(current.groupBy),
    }));
  }

  function handleSaveView() {
    const name = saveName.trim() || `View ${savedViews.length + 1}`;
    startTransition(async () => {
      const result = await savePackagesView(name, config);
      if (result.error) {
        setViewsError(result.error);
        return;
      }
      const views = await fetchPackagesSavedViews();
      setSavedViews(views.views);
      setViewsError(views.error ?? null);
      setSaveName("");
    });
  }

  return (
    <div className={ui.page}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Packages</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Group cohorts, 1-1 runs, and the Kidda Community membership package.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/packages/notion"
            className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Notion sync
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className={ui.btnPrimary}
          >
            New package
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {viewsError && <p className="mb-4 text-sm text-amber-700">{viewsError}</p>}

      <div className="mb-4 space-y-3 rounded-2xl border border-zinc-200/80 bg-white p-4">
        <input
          type="search"
          placeholder="Search package name…"
          value={config.search}
          onChange={(event) => setConfig((c) => ({ ...c, search: event.target.value }))}
          className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <AdminFilterPill
            label={groupByPillLabel(config.groupBy)}
            active={config.groupBy !== "none"}
            onClick={cycleGroupBySetting}
          />
          <AdminFilterPill
            label="Status"
            active={config.filters.status.length > 0}
            onClick={() => setShowStatusFilter((v) => !v)}
          />
          <AdminFilterPill
            label="Tutor"
            active={config.filters.tutorIds.length > 0}
            onClick={() => setShowTutorFilter((v) => !v)}
          />
          <AdminFilterPill
            label="Format"
            active={config.filters.deliveryModes.length > 0}
            onClick={() => setShowFormatFilter((v) => !v)}
          />
          <AdminFilterPill label="Reset" onClick={resetFilters} />
          <button
            type="button"
            onClick={handleSaveView}
            disabled={pending}
            className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
          >
            Save for everyone
          </button>
        </div>

        {showStatusFilter && (
          <div className="flex flex-wrap gap-2">
            {PACKAGE_INSTANCE_STATUSES.map((status) => {
              const active = config.filters.status.includes(status);
              return (
                <AdminFilterPill
                  key={status}
                  label={packageStatusLabel(status)}
                  active={active}
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      filters: {
                        ...c.filters,
                        status: active
                          ? c.filters.status.filter((s) => s !== status)
                          : [...c.filters.status, status],
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        )}

        {showTutorFilter && (
          <div className="flex flex-wrap gap-2">
            {tutors.map((tutor) => {
              const active = config.filters.tutorIds.includes(tutor.id);
              return (
                <AdminFilterPill
                  key={tutor.id}
                  label={tutor.name}
                  active={active}
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      filters: {
                        ...c.filters,
                        tutorIds: active
                          ? c.filters.tutorIds.filter((id) => id !== tutor.id)
                          : [...c.filters.tutorIds, tutor.id],
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        )}

        {showFormatFilter && (
          <div className="flex flex-wrap gap-2">
            {PACKAGE_DELIVERY_FORMATS.map((format) => {
              const active = config.filters.deliveryModes.includes(format);
              return (
                <AdminFilterPill
                  key={format}
                  label={packageDeliveryFormatLabel(format)}
                  active={active}
                  onClick={() =>
                    setConfig((c) => ({
                      ...c,
                      filters: {
                        ...c.filters,
                        deliveryModes: active
                          ? c.filters.deliveryModes.filter((mode) => mode !== format)
                          : [...c.filters.deliveryModes, format],
                      },
                    }))
                  }
                />
              );
            })}
          </div>
        )}

        {savedViews.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
            {savedViews.map((view) => (
              <AdminFilterPill
                key={view.id}
                label={view.name}
                onClick={() => setConfig(view.config)}
                onRemove={() =>
                  startTransition(async () => {
                    await deletePackagesSavedView(view.id);
                    const views = await fetchPackagesSavedViews();
                    setSavedViews(views.views);
                  })
                }
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <button
            type="button"
            className="font-semibold text-violet-600"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                sort: {
                  field: "startDate",
                  direction: c.sort.field === "startDate" && c.sort.direction === "desc" ? "asc" : "desc",
                },
              }))
            }
          >
            {config.sort.field === "startDate" && config.sort.direction === "desc" ? "↓" : "↑"} Start Date
          </button>
          <span>·</span>
          <button
            type="button"
            className="font-semibold text-violet-600"
            onClick={() =>
              setConfig((c) => ({
                ...c,
                sort: {
                  field: "format",
                  direction: c.sort.field === "format" && c.sort.direction === "asc" ? "desc" : "asc",
                },
              }))
            }
          >
            {config.sort.field === "format" && config.sort.direction === "asc" ? "↑" : "↓"} Format
          </button>
          <span>·</span>
          <span>{filteredRows.length} package{filteredRows.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading packages…</p>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.key}>
              {config.groupBy !== "none" && (
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  {group.label} ({group.rows.length})
                </h2>
              )}
              <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white lg:overflow-x-visible">
                <table className="min-w-full text-left text-sm lg:table-fixed lg:w-full">
                  <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 lg:w-[16%]">Package</th>
                      <th className="hidden px-4 py-3 sm:table-cell lg:w-[8%]">Format</th>
                      <th className="px-4 py-3 lg:w-[12%]">Interested</th>
                      <th className="px-4 py-3 lg:w-[12%]">Confirmed</th>
                      <th className="hidden px-4 py-3 md:table-cell lg:w-[8%]">Start day</th>
                      <th className="px-4 py-3 lg:w-[9%]">Tutor</th>
                      <th className="px-4 py-3 lg:w-[8%]">Start</th>
                      <th className="hidden px-4 py-3 sm:table-cell lg:w-[8%]">End</th>
                      <th className="px-4 py-3 lg:w-[10%]">Status</th>
                      <th className="hidden px-4 py-3 sm:table-cell lg:w-[5%]" title="Lesson unlocks logged for this package run">
                        Unlocks
                      </th>
                      <th className="px-4 py-3 lg:w-[5%]" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {group.rows.map((row) => {
                      const format = packageDeliveryFormat(row);
                      return (
                      <tr key={`${row.kind}-${row.id}`} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/packages/${row.id}`}
                            className="font-semibold text-violet-600 hover:text-violet-500"
                          >
                            {row.name}
                          </Link>
                          <p className="text-xs text-zinc-500">{row.courseName}</p>
                          <p className="mt-1 sm:hidden">
                            <AdminStatusPill tone={packageDeliveryFormatPillTone(format)}>
                              {packageDeliveryFormatLabel(format)}
                            </AdminStatusPill>
                          </p>
                        </td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <AdminStatusPill tone={packageDeliveryFormatPillTone(format)}>
                            {packageDeliveryFormatLabel(format)}
                          </AdminStatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <RosterChips members={row.interested} packageId={row.id} roster="interested" />
                        </td>
                        <td className="px-4 py-3">
                          <RosterChips members={row.confirmed} packageId={row.id} roster="confirmed" />
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 md:table-cell">
                          {row.startDayOfWeek ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{row.tutorName ?? "—"}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                          {formatDate(row.startDate)}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-600 sm:table-cell">
                          {formatDate(row.endDate)}
                        </td>
                        <td className="px-4 py-3">
                          <AdminStatusPill tone={packageStatusPillTone(row.status)}>
                            {packageStatusLabel(row.status)}
                          </AdminStatusPill>
                        </td>
                        <td className="hidden px-4 py-3 text-zinc-600 sm:table-cell">
                          {row.lessonUnlockCount > 0 ? (
                            <span title={row.lastLessonLoggedAt ?? undefined}>
                              {row.lessonUnlockCount}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingRow(row)}
                            className="text-xs font-semibold text-violet-600 hover:text-violet-500"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
                {group.rows.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-zinc-500">No packages match.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {showCreate && (
        <PackageRunFormModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={reloadList}
        />
      )}

      {editingRow && (
        <PackageRunFormModal
          mode="edit"
          initial={editingRow}
          onClose={() => setEditingRow(null)}
          onSaved={reloadList}
        />
      )}
    </div>
  );
}
