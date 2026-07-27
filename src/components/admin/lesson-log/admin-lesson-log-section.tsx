"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createAdminLessonLogEntry,
  dismissAdminLessonLogAttention,
  fetchAdminLessonLog,
  refreshLessonLogFromNotion,
  resetAdminLessonLogFieldsToNotion,
  updateAdminLessonLogFields,
  unlockAdminLessonLogEntry,
} from "@/app/admin/lesson-log/actions";
import {
  fetchNotionTutorMapData,
  saveNotionTutorMapping,
  searchNotionWorkspaceUsers,
} from "@/app/admin/packages/notion-actions";
import { LessonLogAttendanceHomeworkPanel } from "@/components/admin/lesson-log/lesson-log-attendance-homework-panel";
import type {
  AdminLessonLogEntry,
  AdminLessonLogGroup,
  LessonLogStatus,
} from "@/lib/admin/load-admin-lesson-log";
import { uploadToStorageAsAdmin } from "@/lib/supabase/admin-upload";
import { ui } from "@/lib/ui/styles";

const LESSON_LOG_MEDIA_BUCKET = "lesson-log-media" as const;
/** Client-side guard aligned with bucket fileSizeLimit (500MB). */
const MAX_RECORDING_UPLOAD_BYTES = 524_288_000;

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso.includes("T") ? iso : `${iso}T12:00:00`));
}

function formatSyncLabel(group: AdminLessonLogGroup): string {
  if (group.syncState === "synced" && group.lastSyncedAt) {
    return `Synced · Last sync ${formatDate(group.lastSyncedAt)}`;
  }
  if (group.syncState === "error") return "Needs attention · sync error";
  if (group.syncState === "pending") return "Pending sync";
  if (group.syncState === "mixed") return "Mixed sync status";
  return "Sync status unknown";
}

function attentionLabel(entry: AdminLessonLogEntry): string | null {
  if (entry.attentionReasons.length === 0) return null;
  const parts: string[] = [];
  if (entry.attentionReasons.includes("unresolved_tutor")) parts.push("unresolved tutor");
  if (entry.attentionReasons.includes("missing_recording")) parts.push("missing recording");
  if (entry.attentionReasons.includes("unlinked_package")) parts.push("unlinked package");
  return parts.join(" · ");
}

export function AdminLessonLogSection() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof fetchAdminLessonLog>> | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LessonLogStatus | "">("");
  const [packageFilter, setPackageFilter] = useState("");
  const [tutorFilter, setTutorFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [tutorMap, setTutorMap] = useState<
    Awaited<ReturnType<typeof fetchNotionTutorMapData>>
  >({ tutors: [], mappings: [] });
  const [mapDraft, setMapDraft] = useState({
    entryId: "",
    notionUserId: "",
    tutorId: "",
  });
  const [notionUsers, setNotionUsers] = useState<
    Array<{ id: string; name: string; type: string }>
  >([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState({
    runId: "",
    lessonDate: todayDateInput(),
    notes: "",
    recordingUrl: "",
    status: "Completed" as LessonLogStatus,
  });
  const [editDraft, setEditDraft] = useState<{
    entryId: string;
    status: LessonLogStatus | "";
    reviewed: boolean;
    notes: string;
    recordingUrl: string;
  } | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);

  function reload() {
    startTransition(async () => {
      setError(null);
      const [data, tutors] = await Promise.all([
        fetchAdminLessonLog(),
        fetchNotionTutorMapData(),
      ]);
      if (data.error) setError(data.error);
      if (tutors.error) setError(tutors.error);
      setSnapshot(data);
      setTutorMap(tutors);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  const filteredGroups = useMemo(() => {
    if (!snapshot) return [];
    const q = search.trim().toLowerCase();
    const showCancelled = includeCancelled || statusFilter === "Cancelled";
    return snapshot.groups
      .map((group) => {
        let entries = group.entries;
        // Default day-to-day view: Cancelled lessons are hidden (also dismissed_at on save).
        if (!showCancelled) {
          entries = entries.filter((e) => e.status !== "Cancelled");
        }
        if (statusFilter) {
          entries = entries.filter((e) => e.status === statusFilter);
        }
        if (dateFrom) {
          entries = entries.filter((e) => e.lessonDate >= dateFrom);
        }
        if (dateTo) {
          entries = entries.filter((e) => e.lessonDate <= dateTo);
        }
        if (attentionOnly) {
          entries = entries.filter((e) => e.attentionReasons.length > 0);
        }
        if (tutorFilter) {
          entries = entries.filter(
            (e) =>
              e.resolvedTutorId === tutorFilter ||
              group.tutorId === tutorFilter
          );
        }
        if (q) {
          entries = entries.filter(
            (e) =>
              (e.lessonTitle ?? "").toLowerCase().includes(q) ||
              group.name.toLowerCase().includes(q) ||
              (e.resolvedTutorName ?? "").toLowerCase().includes(q)
          );
        }
        return { ...group, entries, entryCount: entries.length };
      })
      .filter((group) => {
        if (packageFilter && group.runId !== packageFilter) return false;
        return group.entryCount > 0;
      });
  }, [
    snapshot,
    search,
    statusFilter,
    packageFilter,
    tutorFilter,
    dateFrom,
    dateTo,
    attentionOnly,
    includeCancelled,
  ]);

  async function uploadLessonLogRecording(file: File) {
    if (!editDraft) return;
    if (file.size > MAX_RECORDING_UPLOAD_BYTES) {
      setError(
        `File too large (${Math.round(file.size / 1_000_000)}MB). Max is ${Math.round(MAX_RECORDING_UPLOAD_BYTES / 1_000_000)}MB for recordings.`
      );
      return;
    }
    setUploadingRecording(true);
    setError(null);
    try {
      const url = await uploadToStorageAsAdmin(LESSON_LOG_MEDIA_BUCKET, file);
      setEditDraft({ ...editDraft, recordingUrl: url });
      setMessage("Uploaded — save to persist the recording link.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploadingRecording(false);
    }
  }

  function groupShouldAutoExpand(group: AdminLessonLogGroup): boolean {
    if (group.syncState === "error") return true;
    return group.entries.some((e) =>
      e.attentionReasons.some(
        (r) => r === "unresolved_tutor" || r === "unlinked_package"
      )
    );
  }

  return (
    <div className={`${ui.page} space-y-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/admin/packages" className="font-medium text-violet-600 hover:text-violet-500">
              ← Packages
            </Link>
            {" · "}
            <Link
              href="/admin/packages/notion"
              className="font-medium text-violet-600 hover:text-violet-500"
            >
              Notion sync
            </Link>
          </p>
          <h1 className="mt-1 font-heading text-2xl font-semibold text-zinc-900">Lesson Log</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Notion Lessons Log entries grouped by cohort or 1-1 package instance — same attention
            and sync patterns as Packages.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60"
          >
            {showCreate ? "Hide create" : "Log lesson"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setMessage(null);
                setError(null);
                const result = await refreshLessonLogFromNotion(false);
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
            title="Re-pull every Lessons Log page (use once after schema changes)"
            onClick={() => {
              startTransition(async () => {
                setMessage(null);
                setError(null);
                const result = await refreshLessonLogFromNotion(true);
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

      {message ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {showCreate ? (
        <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
          <p className="text-sm font-medium text-zinc-900">
            Log a lesson from the app ({`source = 'app'`})
          </p>
          <p className="text-xs text-zinc-600">
            Creates a Notion Lessons Log page with the correct New Package DB relation, then stores
            the Notion page id on the Supabase row.
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              value={createDraft.runId}
              onChange={(e) => setCreateDraft((d) => ({ ...d, runId: e.target.value }))}
              className="min-w-[14rem] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose cohort / package…</option>
              {(snapshot?.filters.createTargets ?? []).map((pkg) => (
                <option key={`${pkg.kind}:${pkg.id}`} value={pkg.id}>
                  {pkg.name}
                  {pkg.kind === "package_instance" ? " (1-1)" : ""}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={createDraft.lessonDate}
              onChange={(e) => setCreateDraft((d) => ({ ...d, lessonDate: e.target.value }))}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
            <select
              value={createDraft.status}
              onChange={(e) =>
                setCreateDraft((d) => ({
                  ...d,
                  status: e.target.value as LessonLogStatus,
                }))
              }
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <option value="Completed">Completed</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <input
            value={createDraft.recordingUrl}
            onChange={(e) => setCreateDraft((d) => ({ ...d, recordingUrl: e.target.value }))}
            placeholder="Recording URL (optional)"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <textarea
            value={createDraft.notes}
            onChange={(e) => setCreateDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || !createDraft.runId || !createDraft.lessonDate}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() => {
              const pkg = snapshot?.filters.createTargets.find((p) => p.id === createDraft.runId);
              if (!pkg) {
                setError("Choose a cohort or package.");
                return;
              }
              startTransition(async () => {
                setMessage(null);
                setError(null);
                const result = await createAdminLessonLogEntry({
                  kind: pkg.kind,
                  runId: pkg.id,
                  lessonDate: createDraft.lessonDate,
                  notes: createDraft.notes,
                  recordingUrl: createDraft.recordingUrl,
                  status: createDraft.status,
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                setMessage(
                  `${result.success ?? "Created."}${
                    result.notionPageId ? ` Notion page ${result.notionPageId}` : ""
                  }`
                );
                setShowCreate(false);
                setCreateDraft({
                  runId: "",
                  lessonDate: todayDateInput(),
                  notes: "",
                  recordingUrl: "",
                  status: "Completed",
                });
                reload();
              });
            }}
          >
            Create in app + Notion
          </button>
        </div>
      ) : null}

      {snapshot ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Entries</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{snapshot.totals.entries}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Groups</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-900">{snapshot.totals.groups}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">
              Needs attention
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-950">
              {snapshot.totals.attention}
            </p>
            <p className="mt-1 text-[11px] text-amber-800">
              {snapshot.totals.unresolvedTutor} unresolved tutor ·{" "}
              {snapshot.totals.missingRecording} missing recording · {snapshot.totals.unlinked}{" "}
              unlinked
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Filters</p>
            <button
              type="button"
              className={`mt-2 block text-sm font-medium ${
                attentionOnly ? "text-amber-800" : "text-violet-700"
              }`}
              onClick={() => setAttentionOnly((v) => !v)}
            >
              {attentionOnly ? "Showing attention only" : "Show needs attention"}
            </button>
            <button
              type="button"
              className={`mt-1 block text-sm font-medium ${
                includeCancelled ? "text-zinc-800" : "text-violet-700"
              }`}
              onClick={() => setIncludeCancelled((v) => !v)}
              title="Cancelled lessons are hidden by default and do not count toward progress"
            >
              {includeCancelled ? "Including cancelled" : "Include cancelled"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cohort, lesson, tutor…"
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LessonLogStatus | "")}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {(snapshot?.filters.statuses ?? []).map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={packageFilter}
          onChange={(e) => setPackageFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">All packages</option>
          {(snapshot?.filters.packages ?? []).map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name}
              {pkg.kind === "package_instance" ? " (1-1)" : ""}
            </option>
          ))}
        </select>
        <select
          value={tutorFilter}
          onChange={(e) => setTutorFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">All tutors</option>
          {(snapshot?.filters.tutors ?? []).map((tutor) => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-zinc-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="space-y-3">
        {filteredGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500">
            {snapshot ? "No lesson log groups match these filters." : "Loading…"}
          </p>
        ) : (
          filteredGroups.map((group) => {
            const open = expanded[group.key] ?? groupShouldAutoExpand(group);
            return (
              <section
                key={group.key}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [group.key]: !open }))
                  }
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">
                      {group.name}
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        {group.kind === "cohort"
                          ? "Cohort"
                          : group.kind === "package_instance"
                            ? "1-1 package"
                            : "Unlinked"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {group.entryCount} lesson{group.entryCount === 1 ? "" : "s"}
                      {group.tutorName ? ` · ${group.tutorName}` : ""}
                      {group.latestLessonDate
                        ? ` · Latest ${formatDate(group.latestLessonDate)}`
                        : ""}
                    </p>
                    <p
                      className={`mt-1 text-[11px] font-medium ${
                        group.attentionCount > 0 || group.syncState === "error"
                          ? "text-amber-700"
                          : "text-zinc-500"
                      }`}
                    >
                      {formatSyncLabel(group)}
                      {group.attentionCount > 0
                        ? ` · Needs attention (${group.attentionCount})`
                        : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-zinc-400">
                    {open ? "Hide" : "Show"}
                  </span>
                </button>

                {open ? (
                  <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                    {group.entries.map((entry) => {
                      const attention = attentionLabel(entry);
                      return (
                        <li key={entry.id} className="px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-zinc-900">
                                {entry.curriculumLessonLabel ?? entry.lessonTitle ?? "Untitled lesson"}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {formatDate(entry.lessonDate)}
                                {entry.status ? ` · ${entry.status}` : ""}
                                {entry.statusSource === "manual" ? " (manual)" : ""}
                                {entry.reviewed ? " · Reviewed" : ""}
                                {entry.reviewedSource === "manual" ? " (manual)" : ""}
                                {entry.source === "app" ? " · from app" : ""}
                                {entry.resolvedTutorName
                                  ? ` · ${entry.resolvedTutorName}`
                                  : entry.notionTutorUserId
                                    ? " · Tutor unmapped"
                                    : ""}
                              </p>
                              {entry.curriculumLessonLabel && entry.lessonTitle ? (
                                <p className="mt-0.5 text-[11px] text-zinc-500">
                                  Notion title: {entry.lessonTitle}
                                </p>
                              ) : null}
                              {attention ? (
                                <p className="mt-1 text-[11px] font-semibold text-amber-700">
                                  Needs attention · {attention}
                                </p>
                              ) : null}
                              {entry.attentionReasons.includes("unlinked_package") &&
                              !entry.dismissedAt ? (
                                <button
                                  type="button"
                                  disabled={pending}
                                  className="mt-1 text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline disabled:opacity-60"
                                  title="No Notion Package to link — acknowledge and hide from Needs attention"
                                  onClick={() => {
                                    startTransition(async () => {
                                      setError(null);
                                      setMessage(null);
                                      const result = await dismissAdminLessonLogAttention(
                                        entry.id
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
                              ) : null}
                              {entry.notionSyncError ? (
                                <p className="mt-1 text-[11px] text-red-600">
                                  {entry.notionSyncError}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                className="mt-2 text-xs font-medium text-violet-700 hover:text-violet-500"
                                onClick={() =>
                                  setEditDraft(
                                    editDraft?.entryId === entry.id
                                      ? null
                                      : {
                                          entryId: entry.id,
                                          status: entry.status ?? "",
                                          reviewed: entry.reviewed,
                                          notes: entry.notes ?? "",
                                          recordingUrl: entry.recordingUrl ?? "",
                                        }
                                  )
                                }
                              >
                                {editDraft?.entryId === entry.id
                                  ? "Cancel edit"
                                  : "Edit session"}
                              </button>
                              {editDraft?.entryId === entry.id ? (
                                <div className="mt-2 space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                  {entry.curriculumLessonLabel ? (
                                    <p className="text-xs font-semibold text-zinc-900">
                                      {entry.curriculumLessonLabel}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-amber-800">
                                      No curriculum lesson linked (Cancelled entries are excluded
                                      from the sequence).
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-2 text-[11px]">
                                    {entry.curriculumPdfUrl ? (
                                      <a
                                        href={entry.curriculumPdfUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-violet-700 hover:text-violet-500"
                                      >
                                        Slides (PDF)
                                      </a>
                                    ) : entry.curriculumLessonLabel ? (
                                      <span className="text-zinc-500">No slides PDF in admin content</span>
                                    ) : null}
                                    {entry.curriculumFlashcardSetName ? (
                                      <Link
                                        href="/admin/content?tab=flashcards"
                                        className="font-medium text-violet-700 hover:text-violet-500"
                                      >
                                        Flashcards: {entry.curriculumFlashcardSetName}
                                      </Link>
                                    ) : entry.curriculumLessonLabel ? (
                                      <span className="text-zinc-500">No flashcard set for this week</span>
                                    ) : null}
                                  </div>
                                  {entry.isUnlockedForCohort ? (
                                    <p className="text-[11px] font-medium text-emerald-700">
                                      Unlocked for students in Learn
                                    </p>
                                  ) : entry.curriculumLessonId && group.kind === "cohort" ? (
                                    <button
                                      type="button"
                                      disabled={pending}
                                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-900 disabled:opacity-60"
                                      onClick={() => {
                                        startTransition(async () => {
                                          setError(null);
                                          setMessage(null);
                                          const result = await unlockAdminLessonLogEntry(entry.id);
                                          if (result.error) {
                                            setError(result.error);
                                            return;
                                          }
                                          setMessage(result.success ?? "Unlocked.");
                                          reload();
                                        });
                                      }}
                                    >
                                      Unlock this lesson for cohort
                                    </button>
                                  ) : null}
                                  <p className="text-[11px] text-zinc-600">
                                    Manual override for status/reviewed/notes — does not push to
                                    Notion. Logging unlocks the linked lesson for students when the
                                    cohort&apos;s Auto-unlock on log is on (package detail); use
                                    Unlock below anytime.
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <select
                                      value={editDraft.status}
                                      onChange={(e) =>
                                        setEditDraft({
                                          ...editDraft,
                                          status: e.target.value as LessonLogStatus | "",
                                        })
                                      }
                                      className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                                    >
                                      <option value="">No status</option>
                                      <option value="Scheduled">Scheduled</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Cancelled">Cancelled</option>
                                    </select>
                                    <label className="flex items-center gap-1.5 text-xs text-zinc-700">
                                      <input
                                        type="checkbox"
                                        checked={editDraft.reviewed}
                                        onChange={(e) =>
                                          setEditDraft({
                                            ...editDraft,
                                            reviewed: e.target.checked,
                                          })
                                        }
                                      />
                                      Reviewed
                                    </label>
                                  </div>
                                  <textarea
                                    value={editDraft.notes}
                                    onChange={(e) =>
                                      setEditDraft({ ...editDraft, notes: e.target.value })
                                    }
                                    rows={2}
                                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                                    placeholder="Notes"
                                  />
                                  <div className="space-y-1">
                                    <label className="block text-[11px] font-medium text-zinc-600">
                                      Recording
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                      <input
                                        value={editDraft.recordingUrl}
                                        onChange={(e) =>
                                          setEditDraft({
                                            ...editDraft,
                                            recordingUrl: e.target.value,
                                          })
                                        }
                                        placeholder="Recording URL"
                                        className="min-w-[12rem] flex-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                                      />
                                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                                        {uploadingRecording ? "Uploading…" : "Upload"}
                                        <input
                                          type="file"
                                          accept="video/*,audio/*"
                                          className="sr-only"
                                          disabled={uploadingRecording || pending}
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = "";
                                            if (file) {
                                              void uploadLessonLogRecording(file);
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={pending || uploadingRecording}
                                      className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                                      onClick={() => {
                                        startTransition(async () => {
                                          setError(null);
                                          setMessage(null);
                                          const result = await updateAdminLessonLogFields(
                                            entry.id,
                                            {
                                              status: editDraft.status || null,
                                              reviewed: editDraft.reviewed,
                                              notes: editDraft.notes,
                                              recordingUrl: editDraft.recordingUrl,
                                            }
                                          );
                                          if (result.error) {
                                            setError(result.error);
                                            return;
                                          }
                                          setMessage(result.success ?? "Saved.");
                                          setEditDraft(null);
                                          reload();
                                        });
                                      }}
                                    >
                                      Save manual override
                                    </button>
                                    {(entry.statusSource === "manual" ||
                                      entry.reviewedSource === "manual" ||
                                      entry.notesSource === "manual") && (
                                      <button
                                        type="button"
                                        disabled={pending}
                                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 disabled:opacity-60"
                                        onClick={() => {
                                          startTransition(async () => {
                                            setError(null);
                                            setMessage(null);
                                            const fields: Array<
                                              "status" | "reviewed" | "notes"
                                            > = [];
                                            if (entry.statusSource === "manual") {
                                              fields.push("status");
                                            }
                                            if (entry.reviewedSource === "manual") {
                                              fields.push("reviewed");
                                            }
                                            if (entry.notesSource === "manual") {
                                              fields.push("notes");
                                            }
                                            const result =
                                              await resetAdminLessonLogFieldsToNotion(
                                                entry.id,
                                                fields
                                              );
                                            if (result.error) {
                                              setError(result.error);
                                              return;
                                            }
                                            setMessage(result.success ?? "Reset.");
                                            setEditDraft(null);
                                            reload();
                                          });
                                        }}
                                      >
                                        Reset to Notion
                                      </button>
                                    )}
                                  </div>
                                  <LessonLogAttendanceHomeworkPanel
                                    entryId={entry.id}
                                    isCohort={group.kind === "cohort"}
                                    onMessage={setMessage}
                                    onError={setError}
                                  />
                                </div>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs">
                              {entry.recordingUrl ? (
                                <a
                                  href={entry.recordingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-violet-700 hover:text-violet-500"
                                >
                                  Recording
                                </a>
                              ) : null}
                              {entry.curriculumPdfUrl ? (
                                <a
                                  href={entry.curriculumPdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-medium text-violet-700 hover:text-violet-500"
                                >
                                  Slides
                                </a>
                              ) : null}
                              {entry.curriculumFlashcardSetName ? (
                                <Link
                                  href="/admin/content?tab=flashcards"
                                  className="font-medium text-violet-700 hover:text-violet-500"
                                >
                                  Flashcards
                                </Link>
                              ) : null}
                            </div>
                          </div>

                          {entry.attentionReasons.includes("unresolved_tutor") &&
                          entry.notionTutorUserId ? (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                              <p className="text-xs text-amber-900">
                                Map Notion tutor{" "}
                                <code className="text-[10px]">{entry.notionTutorUserId}</code>{" "}
                                to an app tutor (same flow as Packages → Notion → Tutor map).
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <select
                                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                                  value={
                                    mapDraft.entryId === entry.id ? mapDraft.tutorId : ""
                                  }
                                  onChange={(e) =>
                                    setMapDraft({
                                      entryId: entry.id,
                                      notionUserId: entry.notionTutorUserId!,
                                      tutorId: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Choose tutor…</option>
                                  {tutorMap.tutors.map((tutor) => (
                                    <option key={tutor.id} value={tutor.id}>
                                      {tutor.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={
                                    pending ||
                                    mapDraft.entryId !== entry.id ||
                                    !mapDraft.tutorId
                                  }
                                  className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                                  onClick={() => {
                                    startTransition(async () => {
                                      setError(null);
                                      setMessage(null);
                                      const notionName =
                                        notionUsers.find(
                                          (u) => u.id === entry.notionTutorUserId
                                        )?.name ?? null;
                                      if (!notionName) {
                                        const found = await searchNotionWorkspaceUsers(
                                          entry.notionTutorUserId!
                                        );
                                        if (found.users[0]) {
                                          setNotionUsers((prev) => [
                                            ...prev,
                                            found.users[0]!,
                                          ]);
                                        }
                                      }
                                      const result = await saveNotionTutorMapping(
                                        mapDraft.tutorId,
                                        entry.notionTutorUserId!,
                                        notionName
                                      );
                                      if (result.error) {
                                        setError(result.error);
                                        return;
                                      }
                                      setMessage(result.success ?? "Tutor mapped.");
                                      reload();
                                    });
                                  }}
                                >
                                  Save mapping
                                </button>
                                <Link
                                  href="/admin/packages/notion"
                                  className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700"
                                >
                                  Open tutor map
                                </Link>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
