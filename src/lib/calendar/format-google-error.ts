export function formatGoogleCalendarError(raw: string): string {
  if (raw.includes("calendar-json.googleapis.com") || raw.includes("Google Calendar API has not been used")) {
    const match = raw.match(/project=(\d+)/);
    const project = match?.[1];
    const enableUrl = project
      ? `https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview?project=${project}`
      : "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com";

    return `Google Calendar API is not enabled for your Google Cloud project. Enable it here, wait 1–2 minutes, then sync again: ${enableUrl}`;
  }

  if (raw.includes("accessNotConfigured") || raw.includes("SERVICE_DISABLED")) {
    return "Google Calendar API is disabled in Google Cloud Console. Enable the Calendar API for the same project as your OAuth client, then retry.";
  }

  if (raw.startsWith("Google Calendar list failed:")) {
    try {
      const jsonStart = raw.indexOf("{");
      if (jsonStart >= 0) {
        const payload = JSON.parse(raw.slice(jsonStart)) as {
          error?: { message?: string };
        };
        const message = payload.error?.message;
        if (message) return formatGoogleCalendarError(message);
      }
    } catch {
      // fall through
    }
  }

  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}
