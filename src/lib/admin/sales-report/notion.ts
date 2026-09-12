import { maxFetchEndYmd, minFetchStartYmd, notionDateToYmd, ymdInInclusiveRange } from "@/lib/admin/sales-report/date-range";
import { londonCivilToUtc } from "@/lib/admin/acquisition/date-range";
import type { LeadRecord, SalesCallRecord, SalesReportRange } from "@/lib/admin/sales-report/types";
import {
  NOTION_LEADS_DATA_SOURCE_ID,
  NOTION_SALES_CALL_DATA_SOURCE_ID,
  dateStart,
  fetchDatabaseSchema,
  notionJson,
  plainTextFromTitle,
  relationIds,
  selectName,
  statusName,
} from "@/lib/notion/client";

type NotionPage = {
  id: string;
  created_time?: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
};

type NotionQueryResponse = {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
};

function numberValue(value: { number?: number | null } | undefined): number | null {
  return typeof value?.number === "number" && Number.isFinite(value.number) ? value.number : null;
}

function checkboxValue(value: { checkbox?: boolean } | undefined): boolean {
  return Boolean(value?.checkbox);
}

function peopleFrom(value: { people?: Array<{ id?: string; name?: string | null }> } | undefined): {
  id: string | null;
  name: string | null;
  count: number;
} {
  const people = value?.people ?? [];
  const first = people[0];
  return {
    id: first?.id?.trim() || null,
    name: first?.name?.trim() || null,
    count: people.length,
  };
}

export function parseSalesCallPage(page: NotionPage): SalesCallRecord {
  const props = (page.properties ?? {}) as Record<string, Record<string, unknown>>;
  const person = peopleFrom(props.Person as { people?: Array<{ id?: string; name?: string | null }> });
  const leadIds = relationIds(props.Lead as { relation?: Array<{ id?: string }> });
  return {
    pageId: page.id,
    lastEditedTime: page.last_edited_time ?? page.created_time ?? new Date().toISOString(),
    callDate: notionDateToYmd(dateStart(props.Date as { date?: { start?: string } | null })),
    paymentDate: notionDateToYmd(
      dateStart(props["Payment Date"] as { date?: { start?: string } | null })
    ),
    salespersonId: person.id,
    salespersonName: person.name,
    salespersonCount: person.count,
    outcome: selectName(props.Outcome as { select?: { name?: string } | null }),
    showUp: checkboxValue(props["Show Up"] as { checkbox?: boolean }),
    closed: checkboxValue(props.Closed as { checkbox?: boolean }),
    cashOnCall: numberValue(props["Cash on Call"] as { number?: number | null }),
    paidAfterwards: numberValue(props["Paid Afterwards"] as { number?: number | null }),
    outstandingBalance: numberValue(props["Outstanding Balance"] as { number?: number | null }),
    outBalStatus: statusName(props["Out Bal. Status"] as { status?: { name?: string } | null }),
    course: selectName(props.Course as { select?: { name?: string } | null }),
    delivery: selectName(props.Delivery as { select?: { name?: string } | null }),
    leadPageId: leadIds[0] ?? null,
    notes: plainTextFromTitle(props.Notes as { title?: Array<{ plain_text?: string }> }) || null,
  };
}

export function parseLeadPage(page: NotionPage): LeadRecord {
  const props = (page.properties ?? {}) as Record<string, Record<string, unknown>>;
  const createdTime = page.created_time ?? null;
  return {
    pageId: page.id,
    createdTime,
    createdYmd: notionDateToYmd(createdTime),
    leadSource: selectName(props["Lead Source"] as { select?: { name?: string } | null }),
    name: plainTextFromTitle(props.Name as { title?: Array<{ plain_text?: string }> }) || null,
  };
}

async function queryDatabase(
  databaseId: string,
  filter: Record<string, unknown> | undefined,
  label: string
): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;
    const data = await notionJson<NotionQueryResponse>(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
      cache: "no-store",
    });
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  console.info(`[sales-report] ${label}: ${pages.length} pages`);
  return pages;
}

async function retrieveLeadPage(pageId: string): Promise<LeadRecord | null> {
  try {
    const page = await notionJson<NotionPage>(`/pages/${pageId}`, { cache: "no-store" });
    return parseLeadPage(page);
  } catch (error) {
    console.warn(
      `[sales-report] Could not retrieve lead ${pageId}: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function fillMissingLeads(
  calls: SalesCallRecord[],
  leadsById: Map<string, LeadRecord>,
  startYmd: string,
  endYmd: string
): Promise<void> {
  const missing = [
    ...new Set(
      calls
        .filter(
          (call) =>
            ymdInInclusiveRange(call.callDate, startYmd, endYmd) ||
            ymdInInclusiveRange(call.paymentDate, startYmd, endYmd)
        )
        .map((call) => call.leadPageId)
        .filter((id): id is string => typeof id === "string" && !leadsById.has(id))
    ),
  ];
  const concurrency = 4;
  for (let index = 0; index < missing.length; index += concurrency) {
    const batch = missing.slice(index, index + concurrency);
    const retrieved = await Promise.all(batch.map((id) => retrieveLeadPage(id)));
    for (const lead of retrieved) {
      if (lead) leadsById.set(lead.pageId, lead);
    }
  }
}

export async function assertSalesCallSchema(): Promise<void> {
  const schema = await fetchDatabaseSchema(NOTION_SALES_CALL_DATA_SOURCE_ID);
  const person = schema.properties.Person;
  if (!person || person.type !== "people") {
    throw new Error(
      "Sales Call Log has no Person people field to use as salesperson. Refusing to guess another property."
    );
  }
  if ("Salesperson" in schema.properties) {
    console.info("[sales-report] Salesperson property exists alongside Person; grouping still uses Person.");
  }
}

export async function fetchSalesReportNotionData(range: SalesReportRange): Promise<{
  calls: SalesCallRecord[];
  leads: LeadRecord[];
  productCatalogueAvailable: boolean;
  fetchedAt: string;
}> {
  await assertSalesCallSchema();
  const start = minFetchStartYmd(range);
  const end = maxFetchEndYmd(range);

  const windowFilter = {
    or: [
      {
        and: [
          { property: "Date", date: { on_or_after: start } },
          { property: "Date", date: { on_or_before: end } },
        ],
      },
      {
        and: [
          { property: "Payment Date", date: { on_or_after: start } },
          { property: "Payment Date", date: { on_or_before: end } },
        ],
      },
    ],
  };

  const followUpFilter = {
    and: [
      { property: "Outcome", select: { equals: "Follow Up" } },
      { property: "Closed", checkbox: { equals: false } },
    ],
  };

  const leadsFilter = {
    and: [
      {
        timestamp: "created_time",
        created_time: { on_or_after: londonCivilToUtc(start, 0, 0, 0, 0).toISOString() },
      },
      {
        timestamp: "created_time",
        created_time: { on_or_before: londonCivilToUtc(end, 23, 59, 59, 999).toISOString() },
      },
    ],
  };

  const [windowPages, followUpPages, leadPages] = await Promise.all([
    queryDatabase(NOTION_SALES_CALL_DATA_SOURCE_ID, windowFilter, "sales calls in range"),
    queryDatabase(NOTION_SALES_CALL_DATA_SOURCE_ID, followUpFilter, "open follow-ups"),
    queryDatabase(NOTION_LEADS_DATA_SOURCE_ID, leadsFilter, "leads in range"),
  ]);

  const callsById = new Map<string, SalesCallRecord>();
  for (const page of [...windowPages, ...followUpPages]) {
    callsById.set(page.id, parseSalesCallPage(page));
  }
  const calls = [...callsById.values()];

  const leadsById = new Map<string, LeadRecord>();
  for (const page of leadPages) {
    leadsById.set(page.id, parseLeadPage(page));
  }
  await fillMissingLeads(calls, leadsById, start, end);

  return {
    calls,
    leads: [...leadsById.values()],
    productCatalogueAvailable: false,
    fetchedAt: new Date().toISOString(),
  };
}
