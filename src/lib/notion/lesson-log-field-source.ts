import "server-only";

/** Same contract as cohorts.tutor_id_source — notion | manual. */
export type LessonLogFieldSource = "notion" | "manual";

export function isManualLessonLogFieldSource(
  source: string | null | undefined
): boolean {
  return source === "manual";
}

export type LessonLogManualSources = {
  status_source?: string | null;
  reviewed_source?: string | null;
  notes_source?: string | null;
  /** Create provenance; preserve 'app' so pull does not rewrite it to 'notion'. */
  source?: string | null;
};

/**
 * Strip admin-locked fields from a Notion pull patch (mirrors
 * omitTutorFromPullPatchIfManual). Also preserves source='app' provenance.
 */
export function omitLessonLogManualFieldsFromPullPatch(
  patch: Record<string, unknown>,
  existing: LessonLogManualSources | null | undefined
): Record<string, unknown> {
  const next = { ...patch };

  if (isManualLessonLogFieldSource(existing?.status_source)) {
    delete next.status;
    delete next.status_source;
  }
  if (isManualLessonLogFieldSource(existing?.reviewed_source)) {
    delete next.reviewed;
    delete next.reviewed_source;
  }
  if (isManualLessonLogFieldSource(existing?.notes_source)) {
    delete next.notes;
    delete next.notes_source;
  }

  if (existing?.source === "app") {
    next.source = "app";
  }

  return next;
}
