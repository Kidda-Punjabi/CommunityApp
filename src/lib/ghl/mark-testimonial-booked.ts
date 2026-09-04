import "server-only";

const NOTION_API_VERSION = "2022-06-28";

export type GhlCalendarPayload = {
  id?: string;
  calendarName?: string;
  appointmentId?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
};

function notionHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_API_VERSION,
    "Content-Type": "application/json",
  };
}

async function queryLatestLesson12PageId(
  apiKey: string,
  databaseId: string,
  email: string
): Promise<string | null> {
  const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: "POST",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      filter: {
        and: [
          { property: "Email", rich_text: { equals: email } },
          { property: "Lesson", select: { equals: "Lesson 12" } },
        ],
      },
      sorts: [{ property: "Feedback Date", direction: "descending" }],
      page_size: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion query failed (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as { results?: Array<{ id?: string }> };
  return data.results?.[0]?.id ?? null;
}

export async function findLatestLesson12FeedbackPageId(
  email: string
): Promise<string | null> {
  const apiKey = process.env.NOTION_API_KEY?.trim();
  const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID?.trim();
  if (!apiKey || !databaseId) {
    throw new Error("Notion feedback integration is not configured.");
  }

  const exact = await queryLatestLesson12PageId(apiKey, databaseId, email);
  if (exact) return exact;

  const lowered = email.toLowerCase();
  if (lowered !== email) {
    return queryLatestLesson12PageId(apiKey, databaseId, lowered);
  }

  return null;
}

export async function markVideoTestimonialTimeBooked(pageId: string): Promise<void> {
  const apiKey = process.env.NOTION_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Notion feedback integration is not configured.");
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: notionHeaders(apiKey),
    body: JSON.stringify({
      properties: {
        "Video Testimonial Recorded": {
          status: { name: "Time Booked" },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion update failed (${response.status}): ${body.slice(0, 500)}`);
  }
}

export function parseGhlCalendarObject(value: unknown): GhlCalendarPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const calendar: GhlCalendarPayload = {
    id: typeof raw.id === "string" ? raw.id : undefined,
    calendarName: typeof raw.calendarName === "string" ? raw.calendarName : undefined,
    appointmentId: typeof raw.appointmentId === "string" ? raw.appointmentId : undefined,
    startTime: typeof raw.startTime === "string" ? raw.startTime : undefined,
    endTime: typeof raw.endTime === "string" ? raw.endTime : undefined,
    status:
      typeof raw.status === "string"
        ? raw.status
        : typeof raw.appoinmentStatus === "string"
          ? raw.appoinmentStatus
          : undefined,
  };

  if (!calendar.id && !calendar.appointmentId && !calendar.calendarName && !calendar.startTime) {
    return null;
  }

  return calendar;
}
