import "server-only";

import {
  getNotionApiKey,
  notionJson,
  NotionApiError,
  NOTION_API_VERSION,
} from "@/lib/notion/client";
import {
  mergeFeedbackResponseRow,
  parseNotionFeedbackPage,
  type FeedbackResponseExisting,
  type FeedbackResponseFields,
} from "@/lib/notion/feedback-response-map";
import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_FEEDBACK_DATABASE_ID = "30eb5ac4-29c6-80ec-b673-e0d575ba9c1d";
const UPSERT_CHUNK = 80;

export function feedbackDatabaseId(): string {
  return process.env.NOTION_FEEDBACK_DATABASE_ID?.trim() || DEFAULT_FEEDBACK_DATABASE_ID;
}

type NotionQueryResponse = {
  results: Array<{
    id: string;
    last_edited_time: string;
    properties: Record<string, unknown>;
  }>;
  has_more: boolean;
  next_cursor: string | null;
};

function rowFromFields(
  incoming: FeedbackResponseFields,
  twoWay: { actioned: string | null; videoTestimonialRecorded: string | null },
  localUpdatedAt: string | null
) {
  return {
    notion_page_id: incoming.notionPageId,
    full_name: incoming.fullName || null,
    email: incoming.email || null,
    tutor: incoming.tutor,
    cohort: incoming.cohort,
    course: incoming.course,
    lesson: incoming.lesson,
    feedback_date: incoming.feedbackDate,
    learning_relevance: incoming.learningRelevance,
    confidence: incoming.confidence,
    tutor_effectiveness: incoming.tutorEffectiveness,
    understanding: incoming.understanding,
    speaking: incoming.speaking,
    understanding_grammar: incoming.understandingGrammar,
    clarity_structure: incoming.clarityStructure,
    concept_breakdown: incoming.conceptBreakdown,
    supportiveness: incoming.supportiveness,
    overall_score: incoming.overallScore,
    video_testimonial: incoming.videoTestimonial,
    video_testimonial_recorded: twoWay.videoTestimonialRecorded,
    actioned: twoWay.actioned,
    critical_feedback: incoming.criticalFeedback,
    comments: incoming.comments || null,
    notes: incoming.notes || null,
    local_updated_at: localUpdatedAt,
    notion_last_edited_time: incoming.notionLastEditedTime,
    synced_at: new Date().toISOString(),
  };
}

async function queryFeedbackPages(options?: {
  editedAfter?: string | null;
}): Promise<FeedbackResponseFields[]> {
  const pages: FeedbackResponseFields[] = [];
  let cursor: string | null = null;
  const editedAfter = options?.editedAfter ?? null;
  const databaseId = feedbackDatabaseId();

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
    };
    if (editedAfter) {
      body.filter = {
        timestamp: "last_edited_time",
        last_edited_time: { after: editedAfter },
      };
    }
    if (cursor) body.start_cursor = cursor;

    const data = await notionJson<NotionQueryResponse>(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    for (const result of data.results) {
      pages.push(parseNotionFeedbackPage(result));
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
}

async function loadExistingByPageId(
  supabase: SupabaseClient,
  pageIds: string[]
): Promise<Map<string, FeedbackResponseExisting>> {
  const existing = new Map<string, FeedbackResponseExisting>();
  for (let index = 0; index < pageIds.length; index += 200) {
    const chunk = pageIds.slice(index, index + 200);
    const { data, error } = await supabase
      .from("feedback_responses")
      .select("notion_page_id, actioned, video_testimonial_recorded, local_updated_at")
      .in("notion_page_id", chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      existing.set(row.notion_page_id as string, {
        actioned: (row.actioned as string | null) ?? null,
        video_testimonial_recorded: (row.video_testimonial_recorded as string | null) ?? null,
        local_updated_at: (row.local_updated_at as string | null) ?? null,
      });
    }
  }
  return existing;
}

export async function pullFeedbackResponsesFromNotion(
  supabase: SupabaseClient,
  options?: { fullSync?: boolean }
): Promise<{ upserted: number; keptLocalTwoWay: number; errors: string[] }> {
  const errors: string[] = [];
  let editedAfter: string | null = null;

  if (!options?.fullSync) {
    const { data, error } = await supabase
      .from("feedback_responses")
      .select("notion_last_edited_time")
      .not("notion_last_edited_time", "is", null)
      .order("notion_last_edited_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error && !error.message.toLowerCase().includes("does not exist")) {
      errors.push(error.message);
    }
    editedAfter = (data?.notion_last_edited_time as string | null) ?? null;
  }

  let pages: FeedbackResponseFields[] = [];
  try {
    pages = await queryFeedbackPages({ editedAfter });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion feedback query failed.";
    return { upserted: 0, keptLocalTwoWay: 0, errors: [...errors, message] };
  }

  if (pages.length === 0) {
    return { upserted: 0, keptLocalTwoWay: 0, errors };
  }

  const existing = await loadExistingByPageId(
    supabase,
    pages.map((page) => page.notionPageId)
  );

  const rows = pages.map((incoming) => {
    const current = existing.get(incoming.notionPageId) ?? null;
    const merged = mergeFeedbackResponseRow(incoming, current);
    return {
      row: rowFromFields(
        incoming,
        merged,
        current?.local_updated_at ?? null
      ),
      keptLocalTwoWay: merged.keepLocalTwoWay,
    };
  });

  let upserted = 0;
  let keptLocalTwoWay = 0;
  for (let index = 0; index < rows.length; index += UPSERT_CHUNK) {
    const chunk = rows.slice(index, index + UPSERT_CHUNK);
    const { error } = await supabase.from("feedback_responses").upsert(
      chunk.map((entry) => entry.row),
      { onConflict: "notion_page_id" }
    );
    if (error) {
      errors.push(error.message);
      continue;
    }
    upserted += chunk.length;
    keptLocalTwoWay += chunk.filter((entry) => entry.keptLocalTwoWay).length;
  }

  return { upserted, keptLocalTwoWay, errors };
}

export async function pushFeedbackTwoWayField(options: {
  pageId: string;
  field: "Actioned" | "Video Testimonial Recorded";
  value: string | null;
}): Promise<{ lastEditedTime: string }> {
  const apiKey = getNotionApiKey();
  const response = await fetch(`https://api.notion.com/v1/pages/${options.pageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_API_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        [options.field]: options.value
          ? { status: { name: options.value } }
          : { status: null },
      },
    }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new NotionApiError(response.status, body);
  }
  const data = JSON.parse(body) as { last_edited_time?: string };
  return { lastEditedTime: data.last_edited_time ?? new Date().toISOString() };
}
