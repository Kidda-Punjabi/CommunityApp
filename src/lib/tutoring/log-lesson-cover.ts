export type LogLessonCoverResolution =
  | { ok: true; isCoverSession: boolean; notionTutorUserId: string | null }
  | { ok: false; error: string };

export function resolveLogLessonCoverOverride(input: {
  isCoverSession: boolean;
  selectedCoverTutorNotionUserId: string | null | undefined;
  loggerNotionUserId: string | null | undefined;
}): LogLessonCoverResolution {
  if (!input.isCoverSession) {
    return {
      ok: true,
      isCoverSession: false,
      notionTutorUserId: input.loggerNotionUserId?.trim() || null,
    };
  }

  const selected = input.selectedCoverTutorNotionUserId?.trim() || null;
  if (!selected) {
    return { ok: false, error: "Choose who you covered for." };
  }

  return {
    ok: true,
    isCoverSession: true,
    notionTutorUserId: selected,
  };
}
