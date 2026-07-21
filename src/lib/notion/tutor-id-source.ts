import "server-only";

export type TutorIdSource = "notion" | "manual";

export function isManualTutorSource(source: string | null | undefined): boolean {
  return source === "manual";
}

/** Strip tutor_id from a Notion pull patch when the row is admin-locked. */
export function omitTutorFromPullPatchIfManual(
  patch: Record<string, unknown>,
  tutorIdSource: string | null | undefined
): Record<string, unknown> {
  if (!isManualTutorSource(tutorIdSource)) return patch;
  const next = { ...patch };
  delete next.tutor_id;
  return next;
}
