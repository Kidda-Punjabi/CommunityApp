"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminFilterPill } from "@/components/admin/admin-filter-pills";
import type { AdminSavedView, PackagesViewConfig } from "@/lib/admin/packages/types";
import { DEFAULT_PACKAGES_VIEW_CONFIG } from "@/lib/admin/packages/types";
import {
  PACKAGE_TABLE_COLUMNS,
  type PackageTableColumnId,
} from "@/lib/admin/packages/table-columns";
import {
  PACKAGE_DELIVERY_FORMATS,
  PACKAGE_INSTANCE_STATUSES,
  packageDeliveryFormatLabel,
  packageStatusLabel,
} from "@/lib/admin/package-status";
import { ui } from "@/lib/ui/styles";

const ACTIVE_VIEW_STORAGE_KEY = "admin-packages-active-view";

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

const SORT_OPTIONS: Array<{
  field: PackagesViewConfig["sort"]["field"];
  label: string;
}> = [
  { field: "startDate", label: "Start date" },
  { field: "name", label: "Name" },
  { field: "format", label: "Format" },
];

export function readStoredActiveViewId(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(ACTIVE_VIEW_STORAGE_KEY);
  return value && value !== "default" ? value : null;
}

export function storeActiveViewId(viewId: string | null) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, viewId ?? "default");
}

export function configsMatch(a: PackagesViewConfig, b: PackagesViewConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

type TutorOption = { id: string; name: string };

type AdminPackagesBoardHeaderProps = {
  savedViews: AdminSavedView[];
  activeViewId: string | null;
  config: PackagesViewConfig;
  baselineConfig: PackagesViewConfig | null;
  tutors: TutorOption[];
  resultCount: number;
  pending: boolean;
  showNewViewForm: boolean;
  newViewName: string;
  onSetConfig: React.Dispatch<React.SetStateAction<PackagesViewConfig>>;
  onSelectView: (view: AdminSavedView | null) => void;
  onShowNewViewForm: () => void;
  onHideNewViewForm: () => void;
  onNewViewNameChange: (value: string) => void;
  onCreateView: () => void;
  onSaveView: () => void;
  onRenameView: (viewId: string, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onReset: () => void;
  onNewPackage: () => void;
};

export function AdminPackagesBoardHeader({
  savedViews,
  activeViewId,
  config,
  baselineConfig,
  tutors,
  resultCount,
  pending,
  showNewViewForm,
  newViewName,
  onSetConfig,
  onSelectView,
  onShowNewViewForm,
  onHideNewViewForm,
  onNewViewNameChange,
  onCreateView,
  onSaveView,
  onRenameView,
  onDeleteView,
  onReset,
  onNewPackage,
}: AdminPackagesBoardHeaderProps) {
  const [showSearch, setShowSearch] = useState(Boolean(config.search));
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);

  const activeView = savedViews.find((view) => view.id === activeViewId) ?? null;
  const isDirty =
    activeViewId !== null &&
    baselineConfig !== null &&
    !configsMatch(config, baselineConfig);

  const hasFilters =
    config.filters.status.length > 0 ||
    config.filters.tutorIds.length > 0 ||
    config.filters.deliveryModes.length > 0 ||
    config.filters.courseIds.length > 0 ||
    config.groupBy !== "none";

  const hasNonDefaultSort =
    config.sort.field !== DEFAULT_PACKAGES_VIEW_CONFIG.sort.field ||
    config.sort.direction !== DEFAULT_PACKAGES_VIEW_CONFIG.sort.direction;

  const hasHiddenColumns = config.columns.hidden.length > 0;

  const sortLabel = `${config.sort.direction === "desc" ? "↓" : "↑"} ${
    SORT_OPTIONS.find((option) => option.field === config.sort.field)?.label ?? "Sort"
  }`;

  function closePanels() {
    setShowFilterPanel(false);
    setShowSortPanel(false);
    setShowPropertiesPanel(false);
  }

  function toggleFilterPanel() {
    setShowFilterPanel((open) => !open);
    setShowSortPanel(false);
    setShowPropertiesPanel(false);
  }

  function toggleSortPanel() {
    setShowSortPanel((open) => !open);
    setShowFilterPanel(false);
    setShowPropertiesPanel(false);
  }

  function togglePropertiesPanel() {
    setShowPropertiesPanel((open) => !open);
    setShowFilterPanel(false);
    setShowSortPanel(false);
  }

  function toggleColumn(columnId: PackageTableColumnId) {
    onSetConfig((current) => {
      const hidden = new Set(current.columns.hidden);
      if (hidden.has(columnId)) {
        hidden.delete(columnId);
      } else {
        hidden.add(columnId);
      }
      return {
        ...current,
        columns: { hidden: PACKAGE_TABLE_COLUMNS.map((column) => column.id).filter((id) => hidden.has(id)) },
      };
    });
  }

  function toggleSearch() {
    setShowSearch((open) => {
      const next = !open;
      if (!next) {
        onSetConfig((current) => ({ ...current, search: "" }));
      }
      return next;
    });
    closePanels();
  }

  return (
    <div className="border-b border-zinc-100">
      <div className="flex flex-wrap items-center gap-2 px-3 pt-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <ViewTab
            label="All packages"
            active={activeViewId === null}
            onClick={() => onSelectView(null)}
          />
          {savedViews.map((view) => (
            <ViewTab
              key={view.id}
              label={view.name}
              active={activeViewId === view.id}
              dirty={activeViewId === view.id && isDirty}
              onClick={() => onSelectView(view)}
              onDelete={() => onDeleteView(view.id)}
              onRename={(name) => onRenameView(view.id, name)}
            />
          ))}
          {!showNewViewForm ? (
            <button
              type="button"
              onClick={onShowNewViewForm}
              className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-violet-600"
              title="Add view"
            >
              +
            </button>
          ) : null}
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {showSearch ? (
            <input
              type="search"
              value={config.search}
              onChange={(event) =>
                onSetConfig((current) => ({ ...current, search: event.target.value }))
              }
              placeholder="Search packages…"
              className="w-36 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm sm:w-44"
              autoFocus
            />
          ) : null}

          <ToolbarIconButton
            label="Search"
            active={Boolean(config.search)}
            onClick={toggleSearch}
          >
            <SearchIcon />
          </ToolbarIconButton>

          <ToolbarIconButton
            label="Filter"
            active={hasFilters}
            onClick={toggleFilterPanel}
          >
            <FilterIcon />
          </ToolbarIconButton>

          <ToolbarIconButton
            label="Sort"
            active={hasNonDefaultSort}
            onClick={toggleSortPanel}
          >
            <SortIcon />
          </ToolbarIconButton>

          <ToolbarIconButton
            label="Properties"
            active={hasHiddenColumns}
            onClick={togglePropertiesPanel}
          >
            <PropertiesIcon />
          </ToolbarIconButton>

          <Link
            href="/admin/packages/notion"
            className="hidden rounded-lg px-2.5 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 sm:inline"
          >
            Notion
          </Link>

          <button type="button" onClick={onNewPackage} className={ui.btnPrimary}>
            New package
          </button>
        </div>
      </div>

      {showNewViewForm ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-3 py-2 sm:px-4">
          <input
            type="text"
            value={newViewName}
            onChange={(event) => onNewViewNameChange(event.target.value)}
            placeholder="View name, e.g. Sales"
            className="min-w-[10rem] flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") onCreateView();
              if (event.key === "Escape") onHideNewViewForm();
            }}
          />
          <button
            type="button"
            onClick={onCreateView}
            disabled={pending || !newViewName.trim()}
            className="rounded-full bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Create view
          </button>
          <button
            type="button"
            onClick={onHideNewViewForm}
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {!showNewViewForm ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-3 py-2 sm:px-4">
          <ActiveConfigPill label={sortLabel} onClick={toggleSortPanel} tone="sort" />

          {config.filters.status.length > 0 ? (
            <ActiveConfigPill
              label={`Status: ${config.filters.status.map(packageStatusLabel).join(", ")}`}
              onClick={toggleFilterPanel}
              tone="filter"
            />
          ) : null}

          {config.filters.tutorIds.length > 0 ? (
            <ActiveConfigPill
              label={`Tutor: ${config.filters.tutorIds
                .map((id) => tutors.find((tutor) => tutor.id === id)?.name ?? "Tutor")
                .join(", ")}`}
              onClick={toggleFilterPanel}
              tone="filter"
            />
          ) : null}

          {config.filters.deliveryModes.length > 0 ? (
            <ActiveConfigPill
              label={`Format: ${config.filters.deliveryModes
                .map(packageDeliveryFormatLabel)
                .join(", ")}`}
              onClick={toggleFilterPanel}
              tone="filter"
            />
          ) : null}

          {config.groupBy !== "none" ? (
            <ActiveConfigPill
              label={`Group: ${
                GROUP_BY_OPTIONS.find((option) => option.value === config.groupBy)?.label ??
                config.groupBy
              }`}
              onClick={toggleFilterPanel}
              tone="filter"
            />
          ) : null}

          {config.search ? (
            <ActiveConfigPill
              label={`Search: ${config.search}`}
              onClick={toggleSearch}
              tone="filter"
            />
          ) : null}

          {hasHiddenColumns ? (
            <ActiveConfigPill
              label={`${config.columns.hidden.length} hidden`}
              onClick={togglePropertiesPanel}
              tone="filter"
            />
          ) : null}

          <button
            type="button"
            onClick={toggleFilterPanel}
            className="text-xs font-medium text-zinc-500 hover:text-violet-600"
          >
            + Filter
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
            >
              Reset
            </button>
            {isDirty ? (
              <button
                type="button"
                onClick={onSaveView}
                disabled={pending}
                className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 disabled:opacity-50"
              >
                Save for everyone
              </button>
            ) : activeViewId === null && (hasFilters || hasNonDefaultSort || config.search) ? (
              <button
                type="button"
                onClick={onShowNewViewForm}
                className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
              >
                Save for everyone
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showFilterPanel ? (
        <div className="space-y-4 border-t border-zinc-100 bg-zinc-50/50 px-3 py-4 sm:px-4">
          <FilterSection title="Status">
            <div className="flex flex-wrap gap-2">
              {PACKAGE_INSTANCE_STATUSES.map((status) => {
                const active = config.filters.status.includes(status);
                return (
                  <AdminFilterPill
                    key={status}
                    label={packageStatusLabel(status)}
                    active={active}
                    onClick={() =>
                      onSetConfig((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          status: active
                            ? current.filters.status.filter((value) => value !== status)
                            : [...current.filters.status, status],
                        },
                      }))
                    }
                  />
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Tutor">
            <div className="flex flex-wrap gap-2">
              {tutors.length === 0 ? (
                <p className="text-sm text-zinc-500">No tutors assigned yet.</p>
              ) : (
                tutors.map((tutor) => {
                  const active = config.filters.tutorIds.includes(tutor.id);
                  return (
                    <AdminFilterPill
                      key={tutor.id}
                      label={tutor.name}
                      active={active}
                      onClick={() =>
                        onSetConfig((current) => ({
                          ...current,
                          filters: {
                            ...current.filters,
                            tutorIds: active
                              ? current.filters.tutorIds.filter((id) => id !== tutor.id)
                              : [...current.filters.tutorIds, tutor.id],
                          },
                        }))
                      }
                    />
                  );
                })
              )}
            </div>
          </FilterSection>

          <FilterSection title="Format">
            <div className="flex flex-wrap gap-2">
              {PACKAGE_DELIVERY_FORMATS.map((format) => {
                const active = config.filters.deliveryModes.includes(format);
                return (
                  <AdminFilterPill
                    key={format}
                    label={packageDeliveryFormatLabel(format)}
                    active={active}
                    onClick={() =>
                      onSetConfig((current) => ({
                        ...current,
                        filters: {
                          ...current.filters,
                          deliveryModes: active
                            ? current.filters.deliveryModes.filter((mode) => mode !== format)
                            : [...current.filters.deliveryModes, format],
                        },
                      }))
                    }
                  />
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Group by">
            <div className="flex flex-wrap gap-2">
              {GROUP_BY_OPTIONS.map((option) => {
                const active = config.groupBy === option.value;
                return (
                  <AdminFilterPill
                    key={option.value}
                    label={option.label}
                    active={active}
                    onClick={() =>
                      onSetConfig((current) => ({
                        ...current,
                        groupBy: option.value,
                      }))
                    }
                  />
                );
              })}
            </div>
          </FilterSection>
        </div>
      ) : null}

      {showSortPanel ? (
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-3 py-4 sm:px-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Sort</p>
          <div className="flex flex-wrap gap-2">
            {SORT_OPTIONS.map((option) => (
              <AdminFilterPill
                key={option.field}
                label={option.label}
                active={config.sort.field === option.field}
                onClick={() =>
                  onSetConfig((current) => ({
                    ...current,
                    sort: {
                      field: option.field,
                      direction:
                        current.sort.field === option.field && current.sort.direction === "asc"
                          ? "desc"
                          : "asc",
                    },
                  }))
                }
              />
            ))}
            <AdminFilterPill
              label={config.sort.direction === "asc" ? "Ascending" : "Descending"}
              active
              onClick={() =>
                onSetConfig((current) => ({
                  ...current,
                  sort: {
                    ...current.sort,
                    direction: current.sort.direction === "asc" ? "desc" : "asc",
                  },
                }))
              }
            />
          </div>
        </div>
      ) : null}

      {showPropertiesPanel ? (
        <div className="border-t border-zinc-100 bg-zinc-50/50 px-3 py-4 sm:px-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Properties
          </p>
          <div className="flex flex-wrap gap-2">
            {PACKAGE_TABLE_COLUMNS.map((column) => {
              const visible = !config.columns.hidden.includes(column.id);
              return (
                <AdminFilterPill
                  key={column.id}
                  label={column.label}
                  active={visible}
                  onClick={() => toggleColumn(column.id)}
                />
              );
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Click a property to show or hide it in this view. Hidden properties are saved when you
            save the view.
          </p>
        </div>
      ) : null}

      <div className="border-t border-zinc-100 px-3 py-2 text-xs text-zinc-500 sm:px-4">
        {resultCount} package{resultCount === 1 ? "" : "s"}
        {activeView ? (
          <>
            {" "}
            · <span className="font-medium text-zinc-700">{activeView.name}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ViewTab({
  label,
  active,
  dirty,
  onClick,
  onDelete,
  onRename,
}: {
  label: string;
  active: boolean;
  dirty?: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onRename?: (name: string) => void;
}) {
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={onClick}
        onDoubleClick={() => {
          if (!onRename) return;
          const next = window.prompt("Rename view", label);
          if (next?.trim()) onRename(next.trim());
        }}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "bg-zinc-100 text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
        }`}
        title={onRename ? "Double-click to rename" : undefined}
      >
        <TableIcon />
        <span className="max-w-[9rem] truncate sm:max-w-[12rem]">{label}</span>
        {dirty ? <span className="text-violet-500">•</span> : null}
      </button>
      {onDelete && !active ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] text-zinc-600 group-hover:flex hover:bg-red-100 hover:text-red-700"
          aria-label={`Delete ${label} view`}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function ToolbarIconButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative rounded-lg p-2 transition-colors ${
        active
          ? "bg-violet-50 text-violet-700"
          : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
      }`}
    >
      {children}
      {active ? (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-violet-500" />
      ) : null}
    </button>
  );
}

function ActiveConfigPill({
  label,
  onClick,
  tone,
}: {
  label: string;
  onClick: () => void;
  tone: "sort" | "filter";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`max-w-[14rem] truncate rounded-full px-2.5 py-1 text-xs font-medium ${
        tone === "sort"
          ? "bg-sky-50 text-sky-800 hover:bg-sky-100"
          : "bg-amber-50 text-amber-900 hover:bg-amber-100"
      }`}
    >
      {label}
    </button>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      {children}
    </div>
  );
}

function TableIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden>
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="9" r="5.5" />
      <path d="m13.5 13.5 3 3" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M10 4v12M6.5 7.5 10 4l3.5 3.5M6.5 12.5 10 16l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PropertiesIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 6h12M4 10h12M4 14h8" strokeLinecap="round" />
      <circle cx="15" cy="14" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}
