import type { FutureSupportOption } from "./constants";
import type { FeedbackContext, FeedbackSubmitPayload } from "./types";

const NOTION_API_VERSION = "2022-06-28";

type NotionPropertyValue =
  | { title: Array<{ text: { content: string } }> }
  | { rich_text: Array<{ text: { content: string } }> }
  | { select: { name: string } }
  | { multi_select: Array<{ name: string }> }
  | { number: number }
  | { date: { start: string } };

function buildNotesTitle(
  comments: string,
  fullName: string,
  course: string
): string {
  const trimmed = comments.trim();
  if (trimmed) return trimmed.slice(0, 60);
  return `${fullName} — ${course}`;
}

export function buildNotionFeedbackProperties(
  context: FeedbackContext,
  payload: FeedbackSubmitPayload,
  submittedAt: Date
): Record<string, NotionPropertyValue> {
  const properties: Record<string, NotionPropertyValue> = {
    Notes: {
      title: [
        {
          text: {
            content: buildNotesTitle(payload.comments, context.fullName, context.course),
          },
        },
      ],
    },
    "Full Name": {
      rich_text: [{ text: { content: context.fullName } }],
    },
    Email: {
      rich_text: [{ text: { content: context.email } }],
    },
    Cohort: {
      select: { name: context.cohort },
    },
    Course: {
      select: { name: context.course },
    },
    Lesson: {
      select: {
        name:
          payload.formVariant === "community" ? "Community" : context.lessonLabel,
      },
    },
    "Feedback Date": {
      date: { start: submittedAt.toISOString() },
    },
    Confidence: { number: payload.confidence },
    "Tutor Effectiveness": { number: payload.tutorEffectiveness },
    "Learning Relevance": { number: payload.learningRelevance },
    Comments: {
      rich_text: [{ text: { content: payload.comments.trim() } }],
    },
  };

  if (context.phone?.trim()) {
    properties.Phone = {
      rich_text: [{ text: { content: context.phone.trim() } }],
    };
  }

  if (context.notionTutor) {
    properties.Tutor = {
      select: { name: context.notionTutor },
    };
  }

  if (payload.formVariant === "week12") {
    properties.Understanding = { number: payload.understanding! };
    properties.Speaking = { number: payload.speaking! };
    properties["Understanding Grammar"] = { number: payload.understandingGrammar! };
    properties["Clarity & Structure"] = { number: payload.clarityStructure! };
    properties["Concept Breakdown"] = { number: payload.conceptBreakdown! };
    properties.Supportiveness = { number: payload.supportiveness! };
    properties["Overall Score"] = { number: payload.overallScore! };
    properties["Recommend?"] = {
      select: { name: payload.recommend! },
    };
    properties["Video Testimonial?"] = {
      select: { name: payload.videoTestimonial! },
    };
    properties["Future Support?"] = {
      multi_select: (payload.futureSupport ?? []).map((name) => ({ name })),
    };

    if (payload.testimonials?.trim()) {
      properties.Testimonials = {
        rich_text: [{ text: { content: payload.testimonials.trim() } }],
      };
    }
  }

  return properties;
}

export async function createNotionFeedbackPage(
  properties: Record<string, NotionPropertyValue>
): Promise<{ pageId: string }> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID;

  if (!apiKey || !databaseId) {
    throw new Error("Notion feedback integration is not configured.");
  }

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API error (${response.status}): ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as { id: string };
  return { pageId: data.id };
}

export async function updateNotionFeedbackTutor(
  pageId: string,
  tutorName: string
): Promise<void> {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("Notion feedback integration is not configured.");
  }

  const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        Tutor: { select: { name: tutorName } },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API error (${response.status}): ${body.slice(0, 500)}`);
  }
}

export function validateFutureSupport(
  values: string[]
): values is FutureSupportOption[] {
  const allowed = new Set([
    "Speaking more confidently",
    "Listening and understanding fast Punjabi",
    "Grammar and sentence structure",
    "Expanding vocabulary",
    "Pronunciation",
    "Using Punjabi in real-life situations",
    "Other",
  ]);
  return values.every((value) => allowed.has(value));
}

export function parseYesNo(value: unknown): "Yes" | "No" | null {
  if (value === "Yes" || value === true || value === "yes") return "Yes";
  if (value === "No" || value === false || value === "no") return "No";
  return null;
}

export function parseRating(value: unknown): number | null {
  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isNaN(num) || num < 1 || num > 5) return null;
  return num;
}
