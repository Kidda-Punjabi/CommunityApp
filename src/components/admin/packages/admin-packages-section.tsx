"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  deletePackagesSavedView,
  fetchAdminPackagesList,
  fetchPackageFormOptions,
  fetchPackagesSavedViews,
  savePackagesView,
  updatePackagesSavedView,
} from "@/app/admin/packages/actions";
import { AdminStatusPill } from "@/components/admin/admin-filter-pills";
import { PackageRunFormModal } from "@/components/admin/packages/package-run-form-modal";
import { PackageRosterCell } from "@/components/admin/packages/package-roster-cell";
import { PackageLessonProgressCell } from "@/components/admin/packages/package-lesson-progress-cell";
import { PackageTutorCell } from "@/components/admin/packages/package-tutor-cell";
import { PackageCalendarCell } from "@/components/admin/packages/package-calendar-cell";
import {
  AdminPackagesBoardHeader,
  readStoredActiveViewId,
  storeActiveViewId,
} from "@/components/admin/packages/admin-packages-view-tabs";
import type {
  AdminPackageKind,
  AdminPackageListRow,
  AdminSavedView,
  PackagesViewConfig,
} from "@/lib/admin/packages/types";
import { DEFAULT_PACKAGES_VIEW_CONFIG } from "@/lib/admin/packages/types";
import { formatPackageCalendarDate } from "@/lib/admin/package-schedule";
import {
  isPackageColumnVisible,
  packageColumnCellClass,
  packageColumnHeaderClass,
} from "@/lib/admin/packages/table-columns";
import {
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
  return formatPackageCalendarDate(iso);
}

function updatePackageRow(
  rows: AdminPackageListRow[],
  rowKey: { kind: AdminPackageKind; id: string },
  updater: (row: AdminPackageListRow) => AdminPackageListRow
): AdminPackageListRow[] {
  return rows.map((row) =>
    row.kind === rowKey.kind && row.id === rowKey.id ? updater(row) : row
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
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [baselineConfig, setBaselineConfig] = useState<PackagesViewConfig | null>(null);
  const [config, setConfig] = useState<PackagesViewConfig>(DEFAULT_PACKAGES_VIEW_CONFIG);
  const [error, setError] = useState<string | null>(null);
  const [viewsError, setViewsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewViewForm, setShowNewViewForm] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingRow, setEditingRow] = useState<AdminPackageListRow | null>(null);
  const [tutorOptions, setTutorOptions] = useState<Array<{ id: string; name: string }>>([]);

  function handleRosterChange(
    rowKey: { kind: AdminPackageKind; id: string },
    updater: (row: AdminPackageListRow) => AdminPackageListRow
  ) {
    setRows((current) => updatePackageRow(current, rowKey, updater));
  }

  async function reloadList() {
    const list = await fetchAdminPackagesList();
    setRows(list.rows);
    setError(list.error ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [list, views, formOptions] = await Promise.all([
        fetchAdminPackagesList(),
        fetchPackagesSavedViews(),
        fetchPackageFormOptions(),
      ]);
      if (cancelled) return;
      setRows(list.rows);
      setError(list.error ?? null);
      setTutorOptions(formOptions.tutors);
      const viewsList = views.views;
      setSavedViews(viewsList);
      setViewsError(views.error ?? null);

      const storedViewId = readStoredActiveViewId();
      const storedView = storedViewId
        ? viewsList.find((view) => view.id === storedViewId) ?? null
        : null;
      if (storedView) {
        setActiveViewId(storedView.id);
        setConfig(storedView.config);
        setBaselineConfig(storedView.config);
      } else {
        setActiveViewId(null);
        setBaselineConfig(null);
      }

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") void reloadList();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const tutors = useMemo(() => {
    const map = new Map(tutorOptions.map((t) => [t.id, t.name]));
    for (const row of rows) {
      if (row.tutorId && row.tutorName) map.set(row.tutorId, row.tutorName);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [rows, tutorOptions]);

  const filteredRows = useMemo(() => applyViewConfig(rows, config), [rows, config]);
  const grouped = useMemo(() => groupRows(filteredRows, config.groupBy), [filteredRows, config.groupBy]);

  function resetFilters() {
    if (baselineConfig) {
      setConfig(baselineConfig);
      return;
    }
    setConfig(DEFAULT_PACKAGES_VIEW_CONFIG);
  }

  function selectView(view: AdminSavedView | null) {
    if (!view) {
      setActiveViewId(null);
      setConfig(DEFAULT_PACKAGES_VIEW_CONFIG);
      setBaselineConfig(null);
      storeActiveViewId(null);
      return;
    }
    setActiveViewId(view.id);
    setConfig(view.config);
    setBaselineConfig(view.config);
    storeActiveViewId(view.id);
    setShowNewViewForm(false);
    setNewViewName("");
  }

  async function refreshViews(preferredActiveId?: string | null) {
    const views = await fetchPackagesSavedViews();
    setSavedViews(views.views);
    setViewsError(views.error ?? null);

    const nextActiveId =
      preferredActiveId !== undefined
        ? preferredActiveId
        : activeViewId && views.views.some((view) => view.id === activeViewId)
          ? activeViewId
          : null;

    if (nextActiveId) {
      const view = views.views.find((entry) => entry.id === nextActiveId);
      if (view) {
        setActiveViewId(view.id);
        setConfig(view.config);
        setBaselineConfig(view.config);
        storeActiveViewId(view.id);
        return;
      }
    }

    setActiveViewId(null);
    setConfig(DEFAULT_PACKAGES_VIEW_CONFIG);
    setBaselineConfig(null);
    storeActiveViewId(null);
  }

  function handleCreateView() {
    const name = newViewName.trim();
    if (!name) return;

    startTransition(async () => {
      const result = await savePackagesView(name, config);
      if (result.error) {
        setViewsError(result.error);
        return;
      }
      setViewsError(null);
      setShowNewViewForm(false);
      setNewViewName("");
      await refreshViews(result.id ?? null);
    });
  }

  function handleSaveActiveView() {
    if (!activeViewId) return;

    startTransition(async () => {
      const result = await updatePackagesSavedView(activeViewId, { config });
      if (result.error) {
        setViewsError(result.error);
        return;
      }
      setViewsError(null);
      setBaselineConfig(config);
      await refreshViews(activeViewId);
    });
  }

  function handleRenameView(viewId: string, name: string) {
    startTransition(async () => {
      const result = await updatePackagesSavedView(viewId, { name });
      if (result.error) {
        setViewsError(result.error);
        return;
      }
      setViewsError(null);
      await refreshViews(viewId);
    });
  }

  function handleDeleteView(viewId: string) {
    const view = savedViews.find((entry) => entry.id === viewId);
    if (!view) return;
    if (!window.confirm(`Delete the "${view.name}" view? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deletePackagesSavedView(viewId);
      if (result.error) {
        setViewsError(result.error);
        return;
      }
      setViewsError(null);
      await refreshViews(activeViewId === viewId ? null : activeViewId);
    });
  }

  return (
    <div className={ui.page}>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Packages</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Group cohorts, 1-1 runs, and the Kidda Community membership package.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {viewsError && <p className="mb-4 text-sm text-amber-700">{viewsError}</p>}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
        <AdminPackagesBoardHeader
          savedViews={savedViews}
          activeViewId={activeViewId}
          config={config}
          baselineConfig={baselineConfig}
          tutors={tutors}
          resultCount={filteredRows.length}
          pending={pending}
          showNewViewForm={showNewViewForm}
          newViewName={newViewName}
          onSetConfig={setConfig}
          onSelectView={selectView}
          onShowNewViewForm={() => setShowNewViewForm(true)}
          onHideNewViewForm={() => {
            setShowNewViewForm(false);
            setNewViewName("");
          }}
          onNewViewNameChange={setNewViewName}
          onCreateView={handleCreateView}
          onSaveView={handleSaveActiveView}
          onRenameView={handleRenameView}
          onDeleteView={handleDeleteView}
          onReset={resetFilters}
          onNewPackage={() => setShowCreate(true)}
        />

        {loading ? (
          <p className="px-4 py-8 text-sm text-zinc-500">Loading packages…</p>
        ) : (
          <div className="space-y-0">
            {grouped.map((group) => (
              <section key={group.key}>
                {config.groupBy !== "none" && (
                  <h2 className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {group.label} ({group.rows.length})
                  </h2>
                )}
                <div className="overflow-x-auto lg:overflow-x-visible">
                <table className="min-w-full text-left text-sm lg:table-fixed lg:w-full">
                  <thead className="border-b border-zinc-100 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 lg:w-[14%]">Package</th>
                      {isPackageColumnVisible(config, "format") ? (
                        <th className={packageColumnHeaderClass("format")}>Format</th>
                      ) : null}
                      {isPackageColumnVisible(config, "interested") ? (
                        <th className={packageColumnHeaderClass("interested")}>Interested</th>
                      ) : null}
                      {isPackageColumnVisible(config, "waitingForPayment") ? (
                        <th className={packageColumnHeaderClass("waitingForPayment")}>
                          Waiting for payment
                        </th>
                      ) : null}
                      {isPackageColumnVisible(config, "confirmed") ? (
                        <th className={packageColumnHeaderClass("confirmed")}>Confirmed</th>
                      ) : null}
                      {isPackageColumnVisible(config, "startDay") ? (
                        <th className={packageColumnHeaderClass("startDay")}>Start day</th>
                      ) : null}
                      {isPackageColumnVisible(config, "tutor") ? (
                        <th className={packageColumnHeaderClass("tutor")}>Tutor</th>
                      ) : null}
                      {isPackageColumnVisible(config, "calendar") ? (
                        <th className={packageColumnHeaderClass("calendar")}>Calendar event</th>
                      ) : null}
                      {isPackageColumnVisible(config, "startDate") ? (
                        <th className={packageColumnHeaderClass("startDate")}>Start</th>
                      ) : null}
                      {isPackageColumnVisible(config, "endDate") ? (
                        <th className={packageColumnHeaderClass("endDate")}>End</th>
                      ) : null}
                      {isPackageColumnVisible(config, "status") ? (
                        <th className={packageColumnHeaderClass("status")}>Status</th>
                      ) : null}
                      {isPackageColumnVisible(config, "progress") ? (
                        <th
                          className={packageColumnHeaderClass("progress")}
                          title="Lessons completed (Cancelled excluded) · next date · next topic"
                        >
                          Lesson progress
                        </th>
                      ) : null}
                      {isPackageColumnVisible(config, "unlocks") ? (
                        <th
                          className={packageColumnHeaderClass("unlocks")}
                          title="Lessons unlocked for this package run"
                        >
                          Lessons unlocked
                        </th>
                      ) : null}
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
                          <button
                            type="button"
                            onClick={() => setEditingRow(row)}
                            className="mt-0.5 block text-[11px] font-semibold text-zinc-500 hover:text-violet-600"
                          >
                            Edit
                          </button>
                          <p className="mt-1 text-xs text-zinc-500">{row.courseName}</p>
                          {isPackageColumnVisible(config, "format") ? (
                            <p className="mt-1 sm:hidden">
                              <AdminStatusPill tone={packageDeliveryFormatPillTone(format)}>
                                {packageDeliveryFormatLabel(format)}
                              </AdminStatusPill>
                            </p>
                          ) : null}
                        </td>
                        {isPackageColumnVisible(config, "format") ? (
                          <td className={packageColumnCellClass("format")}>
                            <AdminStatusPill tone={packageDeliveryFormatPillTone(format)}>
                              {packageDeliveryFormatLabel(format)}
                            </AdminStatusPill>
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "interested") ? (
                          <td className={packageColumnCellClass("interested")}>
                            <PackageRosterCell
                              row={row}
                              status="interested"
                              members={row.interested}
                              onRosterChange={handleRosterChange}
                            />
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "waitingForPayment") ? (
                          <td className={packageColumnCellClass("waitingForPayment")}>
                            <PackageRosterCell
                              row={row}
                              status="waiting_for_payment"
                              members={row.waitingForPayment}
                              onRosterChange={handleRosterChange}
                            />
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "confirmed") ? (
                          <td className={packageColumnCellClass("confirmed")}>
                            <PackageRosterCell
                              row={row}
                              status="confirmed"
                              members={row.confirmed}
                              onRosterChange={handleRosterChange}
                            />
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "startDay") ? (
                          <td className={packageColumnCellClass("startDay")}>
                            {row.startDayOfWeek ?? "—"}
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "tutor") ? (
                          <td className={packageColumnCellClass("tutor")}>
                            <PackageTutorCell
                              row={row}
                              tutors={tutors}
                              onUpdated={(patch) =>
                                handleRosterChange(
                                  { kind: row.kind, id: row.id },
                                  (current) => ({ ...current, ...patch })
                                )
                              }
                            />
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "calendar") ? (
                          <td className={packageColumnCellClass("calendar")}>
                            {row.kind === "community" ? (
                              <span className="text-zinc-400">—</span>
                            ) : (
                              <PackageCalendarCell
                                row={row}
                                onLinked={() => void reloadList()}
                              />
                            )}
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "startDate") ? (
                          <td className={packageColumnCellClass("startDate")}>
                            {formatDate(row.startDate)}
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "endDate") ? (
                          <td className={packageColumnCellClass("endDate")}>
                            {formatDate(row.endDate)}
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "status") ? (
                          <td className={packageColumnCellClass("status")}>
                            <AdminStatusPill tone={packageStatusPillTone(row.status)}>
                              {packageStatusLabel(row.status)}
                            </AdminStatusPill>
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "progress") ? (
                          <td className={packageColumnCellClass("progress")}>
                            <PackageLessonProgressCell row={row} />
                          </td>
                        ) : null}
                        {isPackageColumnVisible(config, "unlocks") ? (
                          <td className={packageColumnCellClass("unlocks")}>
                            {row.lessonUnlockCount > 0 ? (
                              <span title={row.lastLessonLoggedAt ?? undefined}>
                                {row.lessonUnlockCount}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
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
      </div>

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
          onDeleted={reloadList}
        />
      )}
    </div>
  );
}
