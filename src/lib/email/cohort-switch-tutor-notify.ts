export type TutorCohortSwitchNotifyPayload = {
  studentName: string;
  weekNumber: number | null;
  topic: string | null;
  cohortName: string | null;
  sessionWhen: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function topicLine(topic: string | null): string {
  const trimmed = topic?.trim() || null;
  if (trimmed) return `They're expecting to cover: ${trimmed}.`;
  return "They're expecting to cover the curriculum topic for that week, but it isn't listed on this session yet.";
}

export function buildTutorCohortSwitchNotifyEmail(payload: TutorCohortSwitchNotifyPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const studentName = payload.studentName.trim() || "A student";
  const hasWeek = typeof payload.weekNumber === "number" && Number.isFinite(payload.weekNumber);
  const sessionLabel = hasWeek ? `Week ${payload.weekNumber} session` : "session";
  const topic = topicLine(payload.topic);
  const flagLine =
    "If this isn't the topic you're planning to cover that week, please reply to this email so we can sort it out.";
  const opening = `${studentName} is joining your ${sessionLabel} as part of a reschedule. ${topic}`;

  const subject =
    typeof payload.weekNumber === "number" && Number.isFinite(payload.weekNumber)
      ? `Reschedule: ${studentName} is joining your Week ${payload.weekNumber} session`
      : `Reschedule: ${studentName} is joining your session`;

  const lines = [opening, "", flagLine];
  if (payload.cohortName?.trim()) {
    lines.push("", `Cohort: ${payload.cohortName.trim()}`);
  }
  if (payload.sessionWhen?.trim()) {
    lines.push(`When: ${payload.sessionWhen.trim()}`);
  }

  const text = lines.join("\n");
  const extraRows: string[] = [];
  if (payload.cohortName?.trim()) {
    extraRows.push(
      `<p style="margin:12px 0 0;color:#555;">Cohort: ${escapeHtml(payload.cohortName.trim())}</p>`
    );
  }
  if (payload.sessionWhen?.trim()) {
    extraRows.push(
      `<p style="margin:4px 0 0;color:#555;">When: ${escapeHtml(payload.sessionWhen.trim())}</p>`
    );
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.45;color:#111;">
      <p style="margin:0 0 12px;">${escapeHtml(opening)}</p>
      <p style="margin:0;">${escapeHtml(flagLine)}</p>
      ${extraRows.join("")}
    </div>
  `.trim();

  return { subject, text, html };
}
