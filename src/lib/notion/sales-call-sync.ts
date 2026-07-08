import "server-only";

import {
  dateStart,
  NOTION_SALES_CALL_DATA_SOURCE_ID,
  notionJson,
  peopleIds,
  plainTextFromTitle,
  relationIds,
  selectName,
  statusName,
} from "@/lib/notion/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export {
  SALES_CALL_COURSES,
  SALES_CALL_DELIVERIES,
  SALES_CALL_MECHANISMS,
  SALES_CALL_OUTCOMES,
  SALES_CALL_RANKINGS,
  SALES_CALL_STATUSES,
  SALES_CALL_TUTORS,
} from "@/lib/admin/sales-calls/options";

export const SALES_CALL_SYNC_FIELDS = [
  "notes",
  "call_date",
  "lead_notion_page_id",
  "user_id",
  "outcome",
  "sales_mechanism",
  "call_length",
  "ranking",
  "course",
  "delivery",
  "tutor_select",
  "tutor_person_id",
  "show_up",
  "offer",
  "closed",
  "payment_made",
  "payment_date",
  "cash_on_call",
  "paid_afterwards",
  "outstanding_balance",
  "status",
  "commission_amount",
  "commission_paid",
  "commission_valid",
  "calendar_invite",
  "welcome_email",
  "whatsapp_chat_made",
  "schedule_whatsapp_group",
  "tutor_notified",
  "time_assigned",
  "package_created",
  "offboarded",
  "offboarded_1",
] as const;

export type SalesCallSyncField = (typeof SALES_CALL_SYNC_FIELDS)[number];

export type SalesCallRow = {
  id: string;
  notes: string | null;
  call_date: string | null;
  lead_notion_page_id: string | null;
  user_id: string | null;
  outcome: string | null;
  sales_mechanism: string | null;
  call_length: number | null;
  ranking: string | null;
  course: string | null;
  delivery: string | null;
  tutor_select: string | null;
  tutor_person_id: string | null;
  show_up: boolean;
  offer: boolean;
  closed: boolean;
  payment_made: boolean;
  payment_date: string | null;
  cash_on_call: number | null;
  paid_afterwards: number | null;
  outstanding_balance: number | null;
  status: string | null;
  commission_amount: number | null;
  commission_paid: boolean;
  commission_valid: boolean;
  calendar_invite: boolean;
  welcome_email: boolean;
  whatsapp_chat_made: boolean;
  schedule_whatsapp_group: boolean;
  tutor_notified: boolean;
  time_assigned: boolean;
  package_created: boolean;
  offboarded: boolean;
  offboarded_1: boolean;
  notion_page_id: string | null;
  notion_synced_at: string | null;
  notion_sync_status: string;
  notion_sync_error: string | null;
  updated_at: string;
};

type NotionPropertyValue =
  | { title: Array<{ text: { content: string } }> }
  | { select: { name: string } | null }
  | { status: { name: string } | null }
  | { date: { start: string } | null }
  | { number: number | null }
  | { checkbox: boolean }
  | { people: Array<{ id: string }> }
  | { relation: Array<{ id: string }> };

type ParsedSalesCallPage = {
  pageId: string;
  lastEditedTime: string;
  fields: Partial<Record<SalesCallSyncField, unknown>>;
};

function checkboxValue(value: { checkbox?: boolean } | undefined): boolean {
  return Boolean(value?.checkbox);
}

function numberValue(value: { number?: number | null } | undefined): number | null {
  return typeof value?.number === "number" ? value.number : null;
}

function dateIso(value: { date?: { start?: string } | null } | undefined): string | null {
  const start = dateStart(value);
  return start || null;
}

async function loadNotionTutorMap(supabase: SupabaseClient): Promise<{
  byTutorId: Map<string, string>;
  byNotionUserId: Map<string, string>;
}> {
  const { data } = await supabase.from("notion_tutor_map").select("tutor_id, notion_user_id");
  const byTutorId = new Map<string, string>();
  const byNotionUserId = new Map<string, string>();
  for (const row of data ?? []) {
    byTutorId.set(row.tutor_id, row.notion_user_id);
    byNotionUserId.set(row.notion_user_id, row.tutor_id);
  }
  return { byTutorId, byNotionUserId };
}

async function resolveUserIdFromLead(
  supabase: SupabaseClient,
  leadNotionPageId: string | null
): Promise<string | null> {
  if (!leadNotionPageId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("notion_lead_page_id", leadNotionPageId)
    .maybeSingle();
  return data?.id ?? null;
}

export function salesCallSyncFieldsChanged(
  oldRecord: Record<string, unknown> | null,
  newRecord: Record<string, unknown>
): boolean {
  if (!oldRecord) return true;
  return SALES_CALL_SYNC_FIELDS.some((field) => oldRecord[field] !== newRecord[field]);
}

export function buildSalesCallNotionProperties(
  row: SalesCallRow,
  tutorMapByTutorId: Map<string, string>
): { properties: Record<string, NotionPropertyValue>; skippedTutorPerson: boolean } {
  const properties: Record<string, NotionPropertyValue> = {
    Notes: {
      title: [{ text: { content: row.notes?.trim() || "Untitled sales call" } }],
    },
    "Show Up": { checkbox: row.show_up },
    Offer: { checkbox: row.offer },
    Closed: { checkbox: row.closed },
    "Payment Made": { checkbox: row.payment_made },
    "Commission Paid": { checkbox: row.commission_paid },
    "Commission Valid?": { checkbox: row.commission_valid },
    "Calendar Invite": { checkbox: row.calendar_invite },
    "Welcome Email": { checkbox: row.welcome_email },
    "WhatsApp Chat Made": { checkbox: row.whatsapp_chat_made },
    "Schedule WhatsApp Group": { checkbox: row.schedule_whatsapp_group },
    "Tutor Notified": { checkbox: row.tutor_notified },
    "Time Assigned": { checkbox: row.time_assigned },
    "Package Created": { checkbox: row.package_created },
    Offboarded: { checkbox: row.offboarded },
    "Offboarded (1)": { checkbox: row.offboarded_1 },
  };

  properties.Date = row.call_date ? { date: { start: row.call_date.slice(0, 10) } } : { date: null };
  properties["Payment Date"] = row.payment_date
    ? { date: { start: row.payment_date.slice(0, 10) } }
    : { date: null };

  properties.Outcome = row.outcome ? { select: { name: row.outcome } } : { select: null };
  properties["Sales Mechanism"] = row.sales_mechanism
    ? { select: { name: row.sales_mechanism } }
    : { select: null };
  properties.Ranking = row.ranking ? { select: { name: row.ranking } } : { select: null };
  properties.Course = row.course ? { select: { name: row.course } } : { select: null };
  properties.Delivery = row.delivery ? { select: { name: row.delivery } } : { select: null };
  properties.Tutor = row.tutor_select ? { select: { name: row.tutor_select } } : { select: null };
  properties.Status = row.status ? { status: { name: row.status } } : { status: null };

  properties["Call Length"] = { number: row.call_length };
  properties["Cash on Call"] = { number: row.cash_on_call };
  properties["Paid Afterwards"] = { number: row.paid_afterwards };
  properties["Outstanding Balance"] = { number: row.outstanding_balance };
  properties["Commission Amount"] = { number: row.commission_amount };

  properties.Lead = row.lead_notion_page_id
    ? { relation: [{ id: row.lead_notion_page_id }] }
    : { relation: [] };

  let skippedTutorPerson = false;
  if (row.tutor_person_id) {
    const notionUserId = tutorMapByTutorId.get(row.tutor_person_id);
    if (notionUserId) {
      properties.Person = { people: [{ id: notionUserId }] };
    } else {
      skippedTutorPerson = true;
      console.warn(
        `[notion sales-call sync] Skipping Person for sales_calls.${row.id}: no notion_tutor_map for ${row.tutor_person_id}`
      );
    }
  }

  return { properties, skippedTutorPerson };
}

export function parseNotionSalesCallPage(page: {
  id: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}): ParsedSalesCallPage {
  const props = page.properties as Record<string, Record<string, unknown>>;
  const leadIds = relationIds(props.Lead as { relation?: Array<{ id?: string }> });
  const personIds = peopleIds(props.Person as { people?: Array<{ id?: string }> });

  return {
    pageId: page.id,
    lastEditedTime: page.last_edited_time,
    fields: {
      notes:
        plainTextFromTitle(props.Notes as { title?: Array<{ plain_text?: string }> }) || null,
      call_date: dateIso(props.Date as { date?: { start?: string } | null }),
      lead_notion_page_id: leadIds[0] ?? null,
      outcome: selectName(props.Outcome as { select?: { name?: string } | null }),
      sales_mechanism: selectName(
        props["Sales Mechanism"] as { select?: { name?: string } | null }
      ),
      call_length: numberValue(props["Call Length"] as { number?: number | null }),
      ranking: selectName(props.Ranking as { select?: { name?: string } | null }),
      course: selectName(props.Course as { select?: { name?: string } | null }),
      delivery: selectName(props.Delivery as { select?: { name?: string } | null }),
      tutor_select: selectName(props.Tutor as { select?: { name?: string } | null }),
      tutor_person_id: personIds[0] ?? null, // resolved to profile id later
      show_up: checkboxValue(props["Show Up"] as { checkbox?: boolean }),
      offer: checkboxValue(props.Offer as { checkbox?: boolean }),
      closed: checkboxValue(props.Closed as { checkbox?: boolean }),
      payment_made: checkboxValue(props["Payment Made"] as { checkbox?: boolean }),
      payment_date: dateIso(props["Payment Date"] as { date?: { start?: string } | null }),
      cash_on_call: numberValue(props["Cash on Call"] as { number?: number | null }),
      paid_afterwards: numberValue(props["Paid Afterwards"] as { number?: number | null }),
      outstanding_balance: numberValue(
        props["Outstanding Balance"] as { number?: number | null }
      ),
      status: statusName(props.Status as { status?: { name?: string } | null }),
      commission_amount: numberValue(props["Commission Amount"] as { number?: number | null }),
      commission_paid: checkboxValue(props["Commission Paid"] as { checkbox?: boolean }),
      commission_valid: checkboxValue(props["Commission Valid?"] as { checkbox?: boolean }),
      calendar_invite: checkboxValue(props["Calendar Invite"] as { checkbox?: boolean }),
      welcome_email: checkboxValue(props["Welcome Email"] as { checkbox?: boolean }),
      whatsapp_chat_made: checkboxValue(props["WhatsApp Chat Made"] as { checkbox?: boolean }),
      schedule_whatsapp_group: checkboxValue(
        props["Schedule WhatsApp Group"] as { checkbox?: boolean }
      ),
      tutor_notified: checkboxValue(props["Tutor Notified"] as { checkbox?: boolean }),
      time_assigned: checkboxValue(props["Time Assigned"] as { checkbox?: boolean }),
      package_created: checkboxValue(props["Package Created"] as { checkbox?: boolean }),
      offboarded: checkboxValue(props.Offboarded as { checkbox?: boolean }),
      offboarded_1: checkboxValue(props["Offboarded (1)"] as { checkbox?: boolean }),
    },
  };
}

async function createNotionSalesCallPage(
  properties: Record<string, NotionPropertyValue>
): Promise<string> {
  console.info(
    `[notion sales-call sync] Creating page in Sales Call Log ${NOTION_SALES_CALL_DATA_SOURCE_ID}`
  );
  const data = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_SALES_CALL_DATA_SOURCE_ID },
      properties,
    }),
  });
  return data.id;
}

async function updateNotionSalesCallPage(
  pageId: string,
  properties: Record<string, NotionPropertyValue>
): Promise<void> {
  await notionJson(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
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

export async function queryNotionSalesCallPagesEditedAfter(
  editedAfter: string | null
): Promise<ParsedSalesCallPage[]> {
  const pages: ParsedSalesCallPage[] = [];
  let cursor: string | null = null;

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

    const data = await notionJson<NotionQueryResponse>(
      `/databases/${NOTION_SALES_CALL_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    for (const result of data.results) {
      pages.push(parseNotionSalesCallPage(result));
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
}

export async function pushSalesCallToNotion(
  supabase: SupabaseClient,
  salesCallId: string
): Promise<{ ok: boolean; error?: string; skippedTutorPerson?: boolean }> {
  const { data: row, error: loadError } = await supabase
    .from("sales_calls")
    .select("*")
    .eq("id", salesCallId)
    .maybeSingle();

  if (loadError || !row) {
    return { ok: false, error: loadError?.message ?? "Sales call not found." };
  }

  const { byTutorId } = await loadNotionTutorMap(supabase);
  const { properties, skippedTutorPerson } = buildSalesCallNotionProperties(
    row as SalesCallRow,
    byTutorId
  );

  try {
    let pageId = row.notion_page_id as string | null;
    if (!pageId) {
      pageId = await createNotionSalesCallPage(properties);
    } else {
      await updateNotionSalesCallPage(pageId, properties);
    }

    const notionPage = await notionJson<{ last_edited_time: string }>(`/pages/${pageId}`);

    await supabase
      .from("sales_calls")
      .update({
        notion_page_id: pageId,
        notion_synced_at: notionPage.last_edited_time,
        notion_sync_status: "synced",
        notion_sync_error: null,
      })
      .eq("id", salesCallId);

    return { ok: true, skippedTutorPerson };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notion push failed.";
    console.error(`[notion sales-call sync] push failed for ${salesCallId}:`, message);
    await supabase
      .from("sales_calls")
      .update({
        notion_sync_status: "error",
        notion_sync_error: message.slice(0, 1000),
      })
      .eq("id", salesCallId);
    return { ok: false, error: message, skippedTutorPerson };
  }
}

export async function pullSalesCallsFromNotion(
  supabase: SupabaseClient
): Promise<{
  upserted: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  dataSourceId: string;
}> {
  console.info(
    `[notion sales-call sync] Pulling from Sales Call Log ${NOTION_SALES_CALL_DATA_SOURCE_ID}`
  );

  const { data: watermarkRow } = await supabase
    .from("sales_calls")
    .select("notion_synced_at")
    .not("notion_synced_at", "is", null)
    .order("notion_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const editedAfter = (watermarkRow?.notion_synced_at as string | null) ?? null;
  const pages = await queryNotionSalesCallPagesEditedAfter(editedAfter);
  const { byNotionUserId } = await loadNotionTutorMap(supabase);

  let upserted = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const page of pages) {
    try {
      const { data: existing } = await supabase
        .from("sales_calls")
        .select("id, notion_synced_at, updated_at")
        .eq("notion_page_id", page.pageId)
        .maybeSingle();

      if (
        existing?.notion_synced_at &&
        existing.notion_synced_at >= page.lastEditedTime
      ) {
        skipped += 1;
        continue;
      }

      const notionPersonId =
        typeof page.fields.tutor_person_id === "string" ? page.fields.tutor_person_id : null;
      const tutorPersonId = notionPersonId
        ? byNotionUserId.get(notionPersonId) ?? null
        : null;

      const leadNotionPageId =
        typeof page.fields.lead_notion_page_id === "string"
          ? page.fields.lead_notion_page_id
          : null;
      const userId = await resolveUserIdFromLead(supabase, leadNotionPageId);

      const payload = {
        ...page.fields,
        tutor_person_id: tutorPersonId,
        user_id: userId,
        notion_page_id: page.pageId,
        notion_synced_at: page.lastEditedTime,
        notion_sync_status: "synced",
        notion_sync_error: null,
      };

      if (existing) {
        const { error } = await supabase
          .from("sales_calls")
          .update(payload)
          .eq("id", existing.id);
        if (error) {
          errors.push(`${page.pageId}: ${error.message}`);
          continue;
        }
        updated += 1;
      } else {
        const { error } = await supabase.from("sales_calls").insert(payload);
        if (error) {
          errors.push(`${page.pageId}: ${error.message}`);
          continue;
        }
        created += 1;
      }
      upserted += 1;
    } catch (error) {
      errors.push(
        `${page.pageId}: ${error instanceof Error ? error.message : "Pull failed."}`
      );
    }
  }

  return {
    upserted,
    created,
    updated,
    skipped,
    errors,
    dataSourceId: NOTION_SALES_CALL_DATA_SOURCE_ID,
  };
}
