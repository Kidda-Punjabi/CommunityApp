"use client";

import {
  createSalesCallAction,
  fetchSalesCallsList,
  searchSalesCallLeadsAction,
  updateSalesCallAction,
} from "@/app/admin/sales-calls/actions";
import { AdminFilterPill } from "@/components/admin/admin-filter-pills";
import {
  SALES_CALL_COURSES,
  SALES_CALL_DELIVERIES,
  SALES_CALL_MECHANISMS,
  SALES_CALL_OUTCOMES,
  SALES_CALL_RANKINGS,
  SALES_CALL_STATUSES,
  SALES_CALL_TUTORS,
} from "@/lib/admin/sales-calls/options";
import type {
  NotionLeadCacheOption,
  SalesCallListRow,
  SalesCallWriteInput,
} from "@/lib/admin/sales-calls/types";
import { ui } from "@/lib/ui/styles";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

function dateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function emptyForm(): SalesCallWriteInput {
  return {
    notes: "",
    callDate: "",
    leadNotionPageId: null,
    outcome: null,
    salesMechanism: null,
    callLength: null,
    ranking: null,
    course: null,
    delivery: null,
    tutorSelect: null,
    tutorPersonId: null,
    showUp: false,
    offer: false,
    closed: false,
    paymentMade: false,
    paymentDate: null,
    cashOnCall: null,
    paidAfterwards: null,
    outstandingBalance: null,
    status: null,
    commissionAmount: null,
    commissionPaid: false,
    commissionValid: false,
    calendarInvite: false,
    welcomeEmail: false,
    whatsappChatMade: false,
    scheduleWhatsappGroup: false,
    tutorNotified: false,
    timeAssigned: false,
    packageCreated: false,
    offboarded: false,
    offboarded1: false,
  };
}

function formFromRow(row: SalesCallListRow): SalesCallWriteInput {
  return {
    notes: row.notes ?? "",
    callDate: dateInputValue(row.callDate),
    leadNotionPageId: row.leadNotionPageId,
    outcome: row.outcome,
    salesMechanism: row.salesMechanism,
    callLength: row.callLength,
    ranking: row.ranking,
    course: row.course,
    delivery: row.delivery,
    tutorSelect: row.tutorSelect,
    tutorPersonId: row.tutorPersonId,
    showUp: row.showUp,
    offer: row.offer,
    closed: row.closed,
    paymentMade: row.paymentMade,
    paymentDate: dateInputValue(row.paymentDate),
    cashOnCall: row.cashOnCall,
    paidAfterwards: row.paidAfterwards,
    outstandingBalance: row.outstandingBalance,
    status: row.status,
    commissionAmount: row.commissionAmount,
    commissionPaid: row.commissionPaid,
    commissionValid: row.commissionValid,
    calendarInvite: row.calendarInvite,
    welcomeEmail: row.welcomeEmail,
    whatsappChatMade: row.whatsappChatMade,
    scheduleWhatsappGroup: row.scheduleWhatsappGroup,
    tutorNotified: row.tutorNotified,
    timeAssigned: row.timeAssigned,
    packageCreated: row.packageCreated,
    offboarded: row.offboarded,
    offboarded1: row.offboarded1,
  };
}

export function AdminSalesCallsSection() {
  const [rows, setRows] = useState<SalesCallListRow[]>([]);
  const [search, setSearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [mechanismFilter, setMechanismFilter] = useState("");
  const [tutorFilter, setTutorFilter] = useState("");
  const [syncFilter, setSyncFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SalesCallWriteInput>(emptyForm);
  const [leadLabel, setLeadLabel] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const list = await fetchSalesCallsList();
    setRows(list.rows);
    setError(list.error ?? null);
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (outcomeFilter && row.outcome !== outcomeFilter) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (courseFilter && row.course !== courseFilter) return false;
      if (deliveryFilter && row.delivery !== deliveryFilter) return false;
      if (mechanismFilter && row.salesMechanism !== mechanismFilter) return false;
      if (tutorFilter && row.tutorSelect !== tutorFilter) return false;
      if (syncFilter && row.notionSyncStatus !== syncFilter) return false;
      if (!q) return true;
      return (
        (row.notes ?? "").toLowerCase().includes(q) ||
        (row.leadName ?? "").toLowerCase().includes(q) ||
        (row.leadEmail ?? "").toLowerCase().includes(q) ||
        (row.outcome ?? "").toLowerCase().includes(q) ||
        (row.course ?? "").toLowerCase().includes(q) ||
        (row.status ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    rows,
    search,
    outcomeFilter,
    statusFilter,
    courseFilter,
    deliveryFilter,
    mechanismFilter,
    tutorFilter,
    syncFilter,
  ]);

  const hasFilters = Boolean(
    outcomeFilter ||
      statusFilter ||
      courseFilter ||
      deliveryFilter ||
      mechanismFilter ||
      tutorFilter ||
      syncFilter
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setLeadLabel("");
    setShowForm(true);
  }

  function openEdit(row: SalesCallListRow) {
    setEditingId(row.id);
    setForm(formFromRow(row));
    setLeadLabel(
      [row.leadName, row.leadEmail].filter(Boolean).join(" · ") ||
        row.leadNotionPageId ||
        ""
    );
    setShowForm(true);
  }

  function save() {
    startTransition(async () => {
      const payload: SalesCallWriteInput = {
        ...form,
        notes: form.notes?.trim() || null,
        callDate: form.callDate || null,
        paymentDate: form.paymentDate || null,
      };

      const result = editingId
        ? await updateSalesCallAction(editingId, payload)
        : await createSalesCallAction(payload);

      if (result.error) {
        setError(result.error);
        return;
      }
      setShowForm(false);
      await reload();
    });
  }

  function applyInlinePatch(
    id: string,
    partial: Pick<SalesCallWriteInput, "course" | "outcome">
  ) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...("course" in partial ? { course: partial.course ?? null } : null),
              ...("outcome" in partial ? { outcome: partial.outcome ?? null } : null),
            }
          : row
      )
    );
  }

  return (
    <div className={ui.page}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Sales calls</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Syncs with Notion Sales Call Log. Formula / rollup fields stay in Notion only.
          </p>
        </div>
        <button type="button" onClick={openCreate} className={ui.btnPrimary}>
          New sales call
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      <div className={`mb-4 overflow-hidden ${ui.card} p-0`}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            {showSearch ? (
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes, lead, course…"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                autoFocus
              />
            ) : (
              <p className="text-sm text-zinc-500">
                Search and filter sales calls like the packages board.
              </p>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1">
            <ToolbarIconButton
              label="Search"
              active={Boolean(search)}
              onClick={() =>
                setShowSearch((open) => {
                  if (open) setSearch("");
                  return !open;
                })
              }
            >
              <SearchIcon />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Filter"
              active={hasFilters}
              onClick={() => setShowFilterPanel((open) => !open)}
            >
              <FilterIcon />
            </ToolbarIconButton>
          </div>
        </div>

        {showFilterPanel ? (
          <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Outcome"
                value={outcomeFilter || null}
                options={SALES_CALL_OUTCOMES}
                onChange={(value) => setOutcomeFilter(value ?? "")}
              />
              <SelectField
                label="Status"
                value={statusFilter || null}
                options={SALES_CALL_STATUSES}
                onChange={(value) => setStatusFilter(value ?? "")}
              />
              <SelectField
                label="Course"
                value={courseFilter || null}
                options={SALES_CALL_COURSES}
                onChange={(value) => setCourseFilter(value ?? "")}
              />
              <SelectField
                label="Delivery"
                value={deliveryFilter || null}
                options={SALES_CALL_DELIVERIES}
                onChange={(value) => setDeliveryFilter(value ?? "")}
              />
              <SelectField
                label="Sales mechanism"
                value={mechanismFilter || null}
                options={SALES_CALL_MECHANISMS}
                onChange={(value) => setMechanismFilter(value ?? "")}
              />
              <SelectField
                label="Tutor"
                value={tutorFilter || null}
                options={SALES_CALL_TUTORS}
                onChange={(value) => setTutorFilter(value ?? "")}
              />
            </div>

            <div className="mt-3 max-w-xs">
              <label className="block text-sm text-zinc-700">
                Sync status
                <select
                  value={syncFilter}
                  onChange={(e) => setSyncFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                >
                  <option value="">All sync states</option>
                  <option value="pending">pending</option>
                  <option value="synced">synced</option>
                  <option value="error">error</option>
                </select>
              </label>
            </div>
          </div>
        ) : null}

        {(Boolean(search) || hasFilters) && (
          <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-3">
            {search ? (
              <AdminFilterPill
                label={`Search: ${search}`}
                active
                onRemove={() => setSearch("")}
              />
            ) : null}
            {outcomeFilter ? (
              <AdminFilterPill
                label={`Outcome: ${outcomeFilter}`}
                active
                onRemove={() => setOutcomeFilter("")}
              />
            ) : null}
            {statusFilter ? (
              <AdminFilterPill
                label={`Status: ${statusFilter}`}
                active
                onRemove={() => setStatusFilter("")}
              />
            ) : null}
            {courseFilter ? (
              <AdminFilterPill
                label={`Course: ${courseFilter}`}
                active
                onRemove={() => setCourseFilter("")}
              />
            ) : null}
            {deliveryFilter ? (
              <AdminFilterPill
                label={`Delivery: ${deliveryFilter}`}
                active
                onRemove={() => setDeliveryFilter("")}
              />
            ) : null}
            {mechanismFilter ? (
              <AdminFilterPill
                label={`Mechanism: ${mechanismFilter}`}
                active
                onRemove={() => setMechanismFilter("")}
              />
            ) : null}
            {tutorFilter ? (
              <AdminFilterPill
                label={`Tutor: ${tutorFilter}`}
                active
                onRemove={() => setTutorFilter("")}
              />
            ) : null}
            {syncFilter ? (
              <AdminFilterPill
                label={`Sync: ${syncFilter}`}
                active
                onRemove={() => setSyncFilter("")}
              />
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setOutcomeFilter("");
                  setStatusFilter("");
                  setCourseFilter("");
                  setDeliveryFilter("");
                  setMechanismFilter("");
                  setTutorFilter("");
                  setSyncFilter("");
                }}
                className="text-xs font-medium text-violet-600 hover:text-violet-500"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        )}

        <div className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {filtered.length} sales call{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className={`overflow-x-auto ${ui.card} p-0`}>
        {loading ? (
          <p className="p-6 text-sm text-zinc-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-sm text-zinc-500">No sales calls yet.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-100 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Cash on call</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sync</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-zinc-50/60">
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                    {dateInputValue(row.callDate) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900">{row.leadName ?? "—"}</p>
                    {row.leadEmail ? (
                      <p className="text-xs text-zinc-500">{row.leadEmail}</p>
                    ) : null}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-zinc-700">
                    {row.notes || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <InlineSelectCell
                      rowId={row.id}
                      field="outcome"
                      value={row.outcome}
                      options={SALES_CALL_OUTCOMES}
                      onSaved={(value) => applyInlinePatch(row.id, { outcome: value })}
                      onError={setError}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    <InlineSelectCell
                      rowId={row.id}
                      field="course"
                      value={row.course}
                      options={SALES_CALL_COURSES}
                      onSaved={(value) => applyInlinePatch(row.id, { course: value })}
                      onError={setError}
                    />
                  </td>
                  <td className="px-4 py-3 text-zinc-700">
                    {row.cashOnCall != null ? row.cashOnCall : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700">{row.status || "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.notionSyncStatus === "synced"
                          ? "bg-emerald-50 text-emerald-700"
                          : row.notionSyncStatus === "error"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-800"
                      }`}
                      title={row.notionSyncError ?? undefined}
                    >
                      {row.notionSyncStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="text-sm font-medium text-violet-600 hover:text-violet-500"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm ? (
        <SalesCallFormModal
          title={editingId ? "Edit sales call" : "New sales call"}
          form={form}
          leadLabel={leadLabel}
          pending={pending}
          onLeadLabelChange={setLeadLabel}
          onChange={setForm}
          onClose={() => setShowForm(false)}
          onSave={save}
        />
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

function InlineSelectCell({
  rowId,
  field,
  value,
  options,
  onSaved,
  onError,
}: {
  rowId: string;
  field: "course" | "outcome";
  value: string | null;
  options: readonly string[];
  onSaved: (value: string | null) => void;
  onError: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setDraft(value ?? "");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setDraft(value ?? "");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, value]);

  function saveInline(nextValue: string | null) {
    startTransition(async () => {
      const result = await updateSalesCallAction(rowId, {
        [field]: nextValue,
      });

      if (result.error) {
        onError(result.error);
        return;
      }

      onError(null);
      onSaved(nextValue);
      setOpen(false);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="w-full rounded-md px-2 py-1 text-left hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        {value || <span className="text-violet-600">Add</span>}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className="absolute left-0 top-full z-20 mt-1 min-w-[13rem] rounded-xl border border-zinc-200 bg-white p-2 shadow-xl"
        >
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            autoFocus
          >
            <option value="">—</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDraft(value ?? "");
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => saveInline(draft || null)}
              className="rounded-md bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
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

function SalesCallFormModal({
  title,
  form,
  leadLabel,
  pending,
  onLeadLabelChange,
  onChange,
  onClose,
  onSave,
}: {
  title: string;
  form: SalesCallWriteInput;
  leadLabel: string;
  pending: boolean;
  onLeadLabelChange: (value: string) => void;
  onChange: (next: SalesCallWriteInput) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const [leadQuery, setLeadQuery] = useState("");
  const [leadResults, setLeadResults] = useState<NotionLeadCacheOption[]>([]);
  const [leadError, setLeadError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = leadQuery.trim();
    if (trimmed.length < 2) {
      setLeadResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchSalesCallLeadsAction(trimmed).then((response) => {
        if (response.error) {
          setLeadError(response.error);
          setLeadResults([]);
          return;
        }
        setLeadError(null);
        setLeadResults(response.results ?? []);
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [leadQuery]);

  function patch(partial: Partial<SalesCallWriteInput>) {
    onChange({ ...form, ...partial });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px)+1rem)] sm:items-center sm:py-8">
      <div className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-zinc-500">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm text-zinc-700">
            Notes
            <input
              value={form.notes ?? ""}
              onChange={(e) => patch({ notes: e.target.value })}
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-zinc-700">
              Call date
              <input
                type="date"
                value={form.callDate ?? ""}
                onChange={(e) => patch({ callDate: e.target.value })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm text-zinc-700">
              Payment date
              <input
                type="date"
                value={form.paymentDate ?? ""}
                onChange={(e) => patch({ paymentDate: e.target.value || null })}
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              />
            </label>
          </div>

          <div>
            <p className="text-sm text-zinc-700">Lead</p>
            {leadLabel ? (
              <div className="mt-1 flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
                <span>{leadLabel}</span>
                <button
                  type="button"
                  className="text-violet-700"
                  onClick={() => {
                    patch({ leadNotionPageId: null });
                    onLeadLabelChange("");
                  }}
                >
                  Clear
                </button>
              </div>
            ) : (
              <input
                type="search"
                value={leadQuery}
                onChange={(e) => setLeadQuery(e.target.value)}
                placeholder="Search Notion leads cache…"
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
            )}
            {leadError ? <p className="mt-1 text-xs text-red-600">{leadError}</p> : null}
            {leadResults.length > 0 ? (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-zinc-200">
                {leadResults.map((lead) => (
                  <li key={lead.notionPageId}>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-violet-50"
                      onClick={() => {
                        patch({ leadNotionPageId: lead.notionPageId });
                        onLeadLabelChange(
                          [lead.name, lead.email].filter(Boolean).join(" · ") ||
                            lead.notionPageId
                        );
                        setLeadQuery("");
                        setLeadResults([]);
                      }}
                    >
                      <span className="font-medium text-zinc-900">{lead.name || "Unnamed"}</span>
                      {lead.email ? (
                        <span className="mt-0.5 block text-xs text-zinc-500">{lead.email}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Outcome"
              value={form.outcome}
              options={SALES_CALL_OUTCOMES}
              onChange={(outcome) => patch({ outcome })}
            />
            <SelectField
              label="Sales mechanism"
              value={form.salesMechanism}
              options={SALES_CALL_MECHANISMS}
              onChange={(salesMechanism) => patch({ salesMechanism })}
            />
            <SelectField
              label="Course"
              value={form.course}
              options={SALES_CALL_COURSES}
              onChange={(course) => patch({ course })}
            />
            <SelectField
              label="Delivery"
              value={form.delivery}
              options={SALES_CALL_DELIVERIES}
              onChange={(delivery) => patch({ delivery })}
            />
            <SelectField
              label="Ranking"
              value={form.ranking}
              options={SALES_CALL_RANKINGS}
              onChange={(ranking) => patch({ ranking })}
            />
            <SelectField
              label="Tutor"
              value={form.tutorSelect}
              options={SALES_CALL_TUTORS}
              onChange={(tutorSelect) => patch({ tutorSelect })}
            />
            <SelectField
              label="Status"
              value={form.status}
              options={SALES_CALL_STATUSES}
              onChange={(status) => patch({ status })}
            />
            <label className="block text-sm text-zinc-700">
              Call length
              <input
                type="number"
                value={form.callLength ?? ""}
                onChange={(e) =>
                  patch({ callLength: e.target.value ? Number(e.target.value) : null })
                }
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <NumberField
              label="Cash on call"
              value={form.cashOnCall}
              onChange={(cashOnCall) => patch({ cashOnCall })}
            />
            <NumberField
              label="Paid afterwards"
              value={form.paidAfterwards}
              onChange={(paidAfterwards) => patch({ paidAfterwards })}
            />
            <NumberField
              label="Outstanding balance"
              value={form.outstandingBalance}
              onChange={(outstandingBalance) => patch({ outstandingBalance })}
            />
            <NumberField
              label="Commission amount"
              value={form.commissionAmount}
              onChange={(commissionAmount) => patch({ commissionAmount })}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                ["showUp", "Show up"],
                ["offer", "Offer"],
                ["closed", "Closed"],
                ["paymentMade", "Payment made"],
                ["commissionPaid", "Commission paid"],
                ["commissionValid", "Commission valid"],
                ["calendarInvite", "Calendar invite"],
                ["welcomeEmail", "Welcome email"],
                ["whatsappChatMade", "WhatsApp chat made"],
                ["scheduleWhatsappGroup", "Schedule WhatsApp group"],
                ["tutorNotified", "Tutor notified"],
                ["timeAssigned", "Time assigned"],
                ["packageCreated", "Package created"],
                ["offboarded", "Offboarded"],
                ["offboarded1", "Offboarded (1)"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
              >
                <input
                  type="checkbox"
                  checked={Boolean(form[key])}
                  onChange={(e) => patch({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <button type="button" onClick={onClose} className={ui.btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onSave}
            className={ui.btnPrimary}
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: readonly string[];
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="block text-sm text-zinc-700">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="block text-sm text-zinc-700">
      {label}
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
      />
    </label>
  );
}
