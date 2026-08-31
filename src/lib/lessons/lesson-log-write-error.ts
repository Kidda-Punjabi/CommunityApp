/**
 * Map Postgres/PostgREST lesson-log write failures to tutor-facing copy.
 * No Sentry (or other error tracker) exists in this app — use console.error.
 */
export function isLessonLogPermissionError(error: {
  code?: string;
  message?: string;
} | null): boolean {
  if (!error) return false;
  if (error.code === "42501" || error.code === "PGRST301") return true;
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("violates row-level security")
  );
}

export function formatLessonLogWriteError(
  error: { code?: string; message?: string } | string | null,
  fallback = "Could not save the lesson log."
): string {
  const payload =
    typeof error === "string"
      ? { message: error }
      : error ?? { message: fallback };
  if (isLessonLogPermissionError(payload)) {
    return "You don't have permission to log this lesson. You need to be the assigned tutor for this class, or covering it via an accepted cover request. If this is a 1-1 package, ask admin to check that your tutor mapping is set.";
  }
  return payload.message?.trim() || fallback;
}

export function logLessonLogWriteFailure(
  context: string,
  error: { code?: string; message?: string } | string | null,
  extra?: Record<string, unknown>
): void {
  const payload =
    typeof error === "string" ? { message: error } : error;
  console.error(`[lesson-log] ${context}`, {
    code: payload?.code ?? null,
    message: payload?.message ?? error,
    permissionDenied: isLessonLogPermissionError(payload ?? null),
    ...extra,
  });
}
