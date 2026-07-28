import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LessonLogStatus = "Scheduled" | "Completed" | "Cancelled";

export type LessonLogAttentionReason =
  | "unresolved_tutor"
  | "missing_recording"
  | "unlinked_package";

export type AdminLessonLogEntry = {
  id: string;
  notionPageId: string;
  lessonTitle: string | null;
  lessonDate: string;
  status: LessonLogStatus | null;
  reviewed: boolean;
  statusSource: "notion" | "manual";
  reviewedSource: "notion" | "manual";
  notesSource: "notion" | "manual";
  recordingUrl: string | null;
  slidesUrl: string | null;
  flashcardsUrl: string | null;
  notes: string | null;
  notionTutorUserId: string | null;
  resolvedTutorId: string | null;
  resolvedTutorName: string | null;
  notionSyncStatus: "pending" | "synced" | "error";
  notionSyncError: string | null;
  notionSyncedAt: string | null;
  source: "notion" | "app";
  dismissedAt: string | null;
  attentionReasons: LessonLogAttentionReason[];
  /** Linked curriculum lesson (lessons.id), when cohort + non-cancelled. */
  curriculumLessonId: string | null;
  curriculumLessonNumber: number | null;
  curriculumLessonTitle: string | null;
  curriculumLessonLabel: string | null;
  /** Slides PDF from lessons.pdf_url (admin content), not Notion slides_url. */
  curriculumPdfUrl: string | null;
  curriculumFlashcardSetId: string | null;
  curriculumFlashcardSetName: string | null;
  isUnlockedForCohort: boolean;
};

export type AdminLessonLogGroup = {
  key: string;
  kind: "cohort" | "package_instance" | "unlinked";
  runId: string | null;
  name: string;
  tutorId: string | null;
  tutorName: string | null;
  entryCount: number;
  attentionCount: number;
  latestLessonDate: string | null;
  lastSyncedAt: string | null;
  syncState: "synced" | "pending" | "error" | "mixed";
  entries: AdminLessonLogEntry[];
};

export type AdminLessonLogSnapshot = {
  groups: AdminLessonLogGroup[];
  totals: {
    entries: number;
    groups: number;
    attention: number;
    unresolvedTutor: number;
    missingRecording: number;
    unlinked: number;
  };
  filters: {
    /** Cohorts and package instances that already have log entries. */
    packages: Array<{ id: string; name: string; kind: "cohort" | "package_instance" }>;
    /** All Notion-linked cohorts/instances for create-from-app. */
    createTargets: Array<{ id: string; name: string; kind: "cohort" | "package_instance" }>;
    tutors: Array<{ id: string; name: string }>;
    statuses: LessonLogStatus[];
  };
};

type EntryRow = {
  id: string;
  notion_page_id: string;
  cohort_id: string | null;
  package_instance_id: string | null;
  lesson_id?: string | null;
  lesson_title: string | null;
  lesson_date: string;
  recording_url: string | null;
  slides_url: string | null;
  flashcards_url: string | null;
  notes: string | null;
  notion_tutor_user_id: string | null;
  status: string | null;
  reviewed: boolean | null;
  status_source: string | null;
  reviewed_source: string | null;
  notes_source: string | null;
  notion_sync_status: string | null;
  notion_sync_error: string | null;
  notion_synced_at: string | null;
  source: string;
  dismissed_at?: string | null;
};

function asFieldSource(value: string | null): "notion" | "manual" {
  return value === "manual" ? "manual" : "notion";
}

/** Missing recording is only actionable for recently completed lessons. */
const MISSING_RECORDING_LOOKBACK_DAYS = 21;

function isActionableMissingRecording(row: {
  status: string | null;
  lesson_date: string;
  recording_url: string | null;
}): boolean {
  if (row.status !== "Completed") return false;
  if (row.recording_url?.trim()) return false;
  const lessonDate = row.lesson_date?.trim();
  if (!lessonDate) return false;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - MISSING_RECORDING_LOOKBACK_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return lessonDate >= cutoffStr;
}

function asStatus(value: string | null): LessonLogStatus | null {
  if (value === "Scheduled" || value === "Completed" || value === "Cancelled") {
    return value;
  }
  return null;
}

function asSyncStatus(value: string | null): "pending" | "synced" | "error" {
  if (value === "synced" || value === "error" || value === "pending") return value;
  return "pending";
}

export async function loadAdminLessonLogSnapshot(
  supabase: SupabaseClient
): Promise<AdminLessonLogSnapshot> {
  // Ensure historical Cancelled rows leave the default day-to-day list.
  const { backfillCancelledLessonLogDismissals } = await import(
    "@/lib/notion/lesson-log-sync"
  );
  await backfillCancelledLessonLogDismissals(supabase);

  const { syncAllCohortLessonLogLessonIds } = await import(
    "@/lib/lessons/lesson-log-lesson-link"
  );
  await syncAllCohortLessonLogLessonIds(supabase);

  const empty: AdminLessonLogSnapshot = {
    groups: [],
    totals: {
      entries: 0,
      groups: 0,
      attention: 0,
      unresolvedTutor: 0,
      missingRecording: 0,
      unlinked: 0,
    },
    filters: {
      packages: [],
      createTargets: [],
      tutors: [],
      statuses: ["Scheduled", "Completed", "Cancelled"],
    },
  };

  const selectWithSources =
    "id, notion_page_id, cohort_id, package_instance_id, lesson_id, lesson_title, lesson_date, recording_url, slides_url, flashcards_url, notes, notion_tutor_user_id, status, reviewed, status_source, reviewed_source, notes_source, notion_sync_status, notion_sync_error, notion_synced_at, source, dismissed_at";
  const selectWithoutSources =
    "id, notion_page_id, cohort_id, package_instance_id, lesson_title, lesson_date, recording_url, slides_url, flashcards_url, notes, notion_tutor_user_id, status, reviewed, notion_sync_status, notion_sync_error, notion_synced_at, source";

  let entries: EntryRow[] | null = null;
  let error: { message: string } | null = null;

  {
    const first = await supabase
      .from("cohort_lesson_log_entries")
      .select(selectWithSources)
      .order("lesson_date", { ascending: false });
    if (
      first.error?.message.includes("status_source") ||
      first.error?.message.includes("reviewed_source") ||
      first.error?.message.includes("notes_source") ||
      first.error?.message.includes("dismissed_at") ||
      first.error?.message.includes("lesson_id")
    ) {
      const second = await supabase
        .from("cohort_lesson_log_entries")
        .select(selectWithoutSources)
        .order("lesson_date", { ascending: false });
      entries = (second.data ?? null) as EntryRow[] | null;
      error = second.error;
    } else {
      entries = (first.data ?? null) as EntryRow[] | null;
      error = first.error;
    }
  }

  if (error) {
    if (
      error.message.includes("cohort_lesson_log_entries") ||
      error.message.includes("status") ||
      error.message.includes("notion_sync_status")
    ) {
      throw new Error(
        `${error.message} Run supabase/cohort-lesson-log-admin.sql and supabase/cohort-lesson-log-manual-source.sql if columns are missing.`
      );
    }
    throw new Error(error.message);
  }

  const rows = (entries ?? []) as EntryRow[];

  const [{ data: linkedCohorts }, { data: linkedInstances }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name")
      .not("notion_page_id", "is", null)
      .order("name"),
    supabase
      .from("package_instances")
      .select("id, name")
      .not("notion_page_id", "is", null)
      .order("name"),
  ]);

  const createTargets = [
    ...(linkedCohorts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      kind: "cohort" as const,
    })),
    ...(linkedInstances ?? []).map((i) => ({
      id: i.id,
      name: i.name?.trim() || "Untitled package instance",
      kind: "package_instance" as const,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  if (rows.length === 0) {
    return {
      ...empty,
      filters: { ...empty.filters, createTargets },
    };
  }

  const cohortIds = [...new Set(rows.map((r) => r.cohort_id).filter(Boolean))] as string[];
  const instanceIds = [
    ...new Set(rows.map((r) => r.package_instance_id).filter(Boolean)),
  ] as string[];

  const [{ data: cohorts }, { data: instances }, { data: tutorMap }] = await Promise.all([
    cohortIds.length
      ? supabase.from("cohorts").select("id, name, tutor_id, course_id").in("id", cohortIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            name: string;
            tutor_id: string | null;
            course_id: string;
          }>,
        }),
    instanceIds.length
      ? supabase
          .from("package_instances")
          .select("id, name, tutor_id")
          .in("id", instanceIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; name: string | null; tutor_id: string | null }>,
        }),
    supabase.from("notion_tutor_map").select("tutor_id, notion_user_id, notion_user_name"),
  ]);

  const tutorIds = [
    ...new Set(
      [
        ...(cohorts ?? []).map((c) => c.tutor_id),
        ...(instances ?? []).map((i) => i.tutor_id),
        ...(tutorMap ?? []).map((m) => m.tutor_id),
      ].filter((id): id is string => Boolean(id))
    ),
  ];

  const { data: profiles } = tutorIds.length
    ? await supabase.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds)
    : { data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> };

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, getDisplayName(p) || "Tutor"] as const)
  );
  const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c] as const));
  const instanceById = new Map((instances ?? []).map((i) => [i.id, i] as const));
  const tutorIdByNotionUserId = new Map(
    (tutorMap ?? []).map((m) => [m.notion_user_id, m.tutor_id] as const)
  );

  const lessonIds = [...new Set(rows.map((r) => r.lesson_id).filter(Boolean))] as string[];
  const { data: lessonRows } = lessonIds.length
    ? await supabase
        .from("lessons")
        .select("id, lesson_number, title, pdf_url, course_id")
        .in("id", lessonIds)
    : { data: [] as Array<{
        id: string;
        lesson_number: number;
        title: string;
        pdf_url: string | null;
        course_id: string;
      }> };

  const lessonById = new Map((lessonRows ?? []).map((lesson) => [lesson.id, lesson] as const));

  const { data: unlockRows } = cohortIds.length
    ? await supabase
        .from("cohort_lesson_unlocks")
        .select("cohort_id, lesson_id")
        .in("cohort_id", cohortIds)
    : { data: [] as Array<{ cohort_id: string; lesson_id: string }> };

  const unlockedLessonKeys = new Set(
    (unlockRows ?? []).map((row) => `${row.cohort_id}:${row.lesson_id}`)
  );

  const { data: learnRecordingRows } =
    cohortIds.length > 0 && lessonIds.length > 0
      ? await supabase
          .from("lesson_recordings")
          .select("cohort_id, lesson_id, storage_path")
          .in("cohort_id", cohortIds)
          .in("lesson_id", lessonIds)
      : { data: [] as Array<{ cohort_id: string; lesson_id: string; storage_path: string }> };

  const learnRecordingByCohortLesson = new Map<string, string>();
  for (const row of learnRecordingRows ?? []) {
    const path = row.storage_path?.trim();
    if (!path) continue;
    learnRecordingByCohortLesson.set(`${row.cohort_id}:${row.lesson_id}`, path);
  }

  const { formatCurriculumLessonLabel, loadLessonContentRefs } = await import(
    "@/lib/lessons/lesson-log-lesson-link"
  );

  const flashcardRefsByLessonId = new Map<
    string,
    { flashcardSetId: string | null; flashcardSetName: string | null }
  >();
  for (const lesson of lessonRows ?? []) {
    const refs = await loadLessonContentRefs(
      supabase,
      lesson.course_id,
      lesson.lesson_number
    );
    flashcardRefsByLessonId.set(lesson.id, {
      flashcardSetId: refs.flashcardSetId,
      flashcardSetName: refs.flashcardSetName,
    });
  }

  const groupsMap = new Map<string, AdminLessonLogGroup>();
  let unresolvedTutor = 0;
  let missingRecording = 0;
  let unlinked = 0;
  let attention = 0;

  for (const row of rows) {
    const resolvedTutorId = row.notion_tutor_user_id
      ? tutorIdByNotionUserId.get(row.notion_tutor_user_id) ?? null
      : null;
    const attentionReasons: LessonLogAttentionReason[] = [];

    if (row.notion_tutor_user_id && !resolvedTutorId) {
      attentionReasons.push("unresolved_tutor");
      unresolvedTutor += 1;
    }
    if (isActionableMissingRecording({
      status: row.status,
      lesson_date: row.lesson_date,
      recording_url:
        row.recording_url ||
        (row.cohort_id && row.lesson_id
          ? learnRecordingByCohortLesson.get(`${row.cohort_id}:${row.lesson_id}`) ?? null
          : null),
    })) {
      attentionReasons.push("missing_recording");
      missingRecording += 1;
    }
    // Unlinked only when still open — dismissed historical empties stay out of the count.
    if (!row.cohort_id && !row.package_instance_id && !row.dismissed_at) {
      attentionReasons.push("unlinked_package");
      unlinked += 1;
    }
    if (attentionReasons.length > 0) attention += 1;

    const linkedLesson = row.lesson_id ? lessonById.get(row.lesson_id) : null;
    const flashcardRefs = row.lesson_id
      ? flashcardRefsByLessonId.get(row.lesson_id)
      : null;
    const curriculumLessonId = linkedLesson?.id ?? null;
    const curriculumLessonNumber = linkedLesson?.lesson_number ?? null;
    const curriculumLessonTitle = linkedLesson?.title ?? null;
    const curriculumLessonLabel =
      linkedLesson
        ? formatCurriculumLessonLabel(linkedLesson.lesson_number, linkedLesson.title)
        : null;
    const isUnlockedForCohort =
      row.cohort_id && curriculumLessonId
        ? unlockedLessonKeys.has(`${row.cohort_id}:${curriculumLessonId}`)
        : false;

    const entry: AdminLessonLogEntry = {
      id: row.id,
      notionPageId: row.notion_page_id,
      lessonTitle: row.lesson_title,
      lessonDate: row.lesson_date,
      status: asStatus(row.status),
      reviewed: Boolean(row.reviewed),
      statusSource: asFieldSource(row.status_source),
      reviewedSource: asFieldSource(row.reviewed_source),
      notesSource: asFieldSource(row.notes_source),
      recordingUrl:
        row.recording_url?.trim() ||
        (row.cohort_id && row.lesson_id
          ? learnRecordingByCohortLesson.get(`${row.cohort_id}:${row.lesson_id}`) ?? null
          : null),
      slidesUrl: row.slides_url,
      flashcardsUrl: row.flashcards_url,
      notes: row.notes,
      notionTutorUserId: row.notion_tutor_user_id,
      resolvedTutorId,
      resolvedTutorName: resolvedTutorId ? profileById.get(resolvedTutorId) ?? null : null,
      notionSyncStatus: asSyncStatus(row.notion_sync_status),
      notionSyncError: row.notion_sync_error,
      notionSyncedAt: row.notion_synced_at,
      source: row.source === "app" ? "app" : "notion",
      dismissedAt: row.dismissed_at ?? null,
      attentionReasons,
      curriculumLessonId,
      curriculumLessonNumber,
      curriculumLessonTitle,
      curriculumLessonLabel,
      curriculumPdfUrl: linkedLesson?.pdf_url ?? null,
      curriculumFlashcardSetId: flashcardRefs?.flashcardSetId ?? null,
      curriculumFlashcardSetName: flashcardRefs?.flashcardSetName ?? null,
      isUnlockedForCohort,
    };

    let key: string;
    let kind: AdminLessonLogGroup["kind"];
    let runId: string | null;
    let name: string;
    let tutorId: string | null;
    let tutorName: string | null;

    if (row.cohort_id) {
      const cohort = cohortById.get(row.cohort_id);
      key = `cohort:${row.cohort_id}`;
      kind = "cohort";
      runId = row.cohort_id;
      name = cohort?.name ?? "Unknown cohort";
      tutorId = cohort?.tutor_id ?? null;
      tutorName = tutorId ? profileById.get(tutorId) ?? null : null;
    } else if (row.package_instance_id) {
      const instance = instanceById.get(row.package_instance_id);
      key = `instance:${row.package_instance_id}`;
      kind = "package_instance";
      runId = row.package_instance_id;
      name = instance?.name ?? "Untitled package instance";
      tutorId = instance?.tutor_id ?? null;
      tutorName = tutorId ? profileById.get(tutorId) ?? null : null;
    } else {
      key = "unlinked";
      kind = "unlinked";
      runId = null;
      name = "Unlinked lessons";
      tutorId = null;
      tutorName = null;
    }

    const existing = groupsMap.get(key);
    if (!existing) {
      groupsMap.set(key, {
        key,
        kind,
        runId,
        name,
        tutorId,
        tutorName,
        entryCount: 1,
        attentionCount: attentionReasons.length > 0 ? 1 : 0,
        latestLessonDate: row.lesson_date,
        lastSyncedAt: row.notion_synced_at,
        syncState: asSyncStatus(row.notion_sync_status),
        entries: [entry],
      });
    } else {
      existing.entryCount += 1;
      if (attentionReasons.length > 0) existing.attentionCount += 1;
      existing.entries.push(entry);
      if (
        !existing.latestLessonDate ||
        row.lesson_date > existing.latestLessonDate
      ) {
        existing.latestLessonDate = row.lesson_date;
      }
      if (
        row.notion_synced_at &&
        (!existing.lastSyncedAt || row.notion_synced_at > existing.lastSyncedAt)
      ) {
        existing.lastSyncedAt = row.notion_synced_at;
      }
      const statuses = new Set(existing.entries.map((e) => e.notionSyncStatus));
      if (statuses.size > 1) existing.syncState = "mixed";
      else existing.syncState = [...statuses][0] ?? "pending";
    }
  }

  const groups = [...groupsMap.values()].sort((a, b) => {
    if (a.kind === "unlinked" && b.kind !== "unlinked") return 1;
    if (b.kind === "unlinked" && a.kind !== "unlinked") return -1;
    const da = a.latestLessonDate ?? "";
    const db = b.latestLessonDate ?? "";
    return db.localeCompare(da) || a.name.localeCompare(b.name);
  });

  const filterPackages = groups
    .filter((g) => g.kind !== "unlinked" && g.runId)
    .map((g) => ({
      id: g.runId!,
      name: g.name,
      kind: g.kind as "cohort" | "package_instance",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const filterTutors = tutorIds
    .map((id) => ({ id, name: profileById.get(id) ?? "Tutor" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    groups,
    totals: {
      entries: rows.length,
      groups: groups.length,
      attention,
      unresolvedTutor,
      missingRecording,
      unlinked,
    },
    filters: {
      packages: filterPackages,
      createTargets,
      tutors: filterTutors,
      statuses: ["Scheduled", "Completed", "Cancelled"],
    },
  };
}
