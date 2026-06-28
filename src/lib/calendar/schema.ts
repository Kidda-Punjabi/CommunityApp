type PostgrestLikeError = {
  code?: string;
  message?: string;
};

export function isCalendarSchemaMissingError(error: PostgrestLikeError): boolean {
  const message = error.message ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST202" ||
    message.includes("tutor_scheduled_sessions") ||
    message.includes("lesson_reschedule_requests") ||
    message.includes("cohort_switch_requests") ||
    message.includes("tutor_google_calendar_connections") ||
    message.includes("tutor_calendar_event_exclusions") ||
    message.includes("get_tutor_calendar_connection_status")
  );
}

export function formatCalendarLoadError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Could not load calendar data. Please refresh and try again.";
  }

  const payload = error as PostgrestLikeError & { hint?: string; details?: string };
  const hint = payload.hint ?? "";
  const details = payload.details ?? "";
  const message = payload.message ?? "";

  if (hint.includes("Headers Overflow") || details.includes("HeadersOverflowError")) {
    return "Too many calendar events to load at once. Try syncing a smaller date range or contact support.";
  }

  if (message.includes("fetch failed") && hint.includes("Headers Overflow")) {
    return "Too many calendar events to load at once. Try syncing a smaller date range or contact support.";
  }

  return message || "Could not load calendar data. Please refresh and try again.";
}
