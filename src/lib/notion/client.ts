/**
 * Shared Notion API helpers — reuses the same token/env pattern as feedback sync.
 */
export const NOTION_API_VERSION = "2022-06-28";

export const NOTION_PACKAGE_DATA_SOURCE_ID =
  process.env.NOTION_PACKAGE_DATA_SOURCE_ID ?? "2a2b5ac4-29c6-805d-922b-d93a13be766d";

export const NOTION_LEADS_DATA_SOURCE_ID =
  process.env.NOTION_LEADS_DATA_SOURCE_ID ?? "293b5ac4-29c6-807e-bb23-db35b02b3fdf";

/** Notion database ID for Sales Call Log (API database_id, not data-source id). */
export const NOTION_SALES_CALL_DATA_SOURCE_ID =
  process.env.NOTION_SALES_CALL_DATA_SOURCE_ID ?? "293b5ac4-29c6-80d0-9f48-c5833fd1ea1b";

/** Notion Lessons Log database (session logs linked to New Package DB). */
export const NOTION_LESSONS_LOG_DATA_SOURCE_ID =
  process.env.NOTION_LESSONS_LOG_DATA_SOURCE_ID ?? "2b0b5ac4-29c6-80b1-ad5e-d3f15d15e6c3";

export class NotionApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Notion API error (${status}): ${body.slice(0, 500)}`);
    this.name = "NotionApiError";
  }
}

export function getNotionApiKey(): string {
  const apiKey = process.env.NOTION_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Notion integration is not configured (NOTION_API_KEY).");
  }
  return apiKey;
}

export function notionHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getNotionApiKey()}`,
    "Notion-Version": NOTION_API_VERSION,
    "Content-Type": "application/json",
  };
}

export async function notionFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      ...notionHeaders(),
      ...(init?.headers ?? {}),
    },
  });
}

export async function notionJson<T>(path: string, init?: RequestInit): Promise<T> {
  const maxAttempts = 4;
  let lastError: NotionApiError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await notionFetch(path, init);
    const body = await response.text();
    if (response.ok) {
      return JSON.parse(body) as T;
    }

    lastError = new NotionApiError(response.status, body);
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === maxAttempts) {
      throw lastError;
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
    const backoffMs = Number.isFinite(retryAfterMs)
      ? Math.max(retryAfterMs, 250)
      : 400 * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }

  throw lastError ?? new NotionApiError(500, "Notion request failed.");
}

export function plainTextFromRichText(
  value: { rich_text?: Array<{ plain_text?: string }> } | undefined
): string {
  return (value?.rich_text ?? []).map((part) => part.plain_text ?? "").join("").trim();
}

export function plainTextFromTitle(
  value: { title?: Array<{ plain_text?: string }> } | undefined
): string {
  return (value?.title ?? []).map((part) => part.plain_text ?? "").join("").trim();
}

export function selectName(
  value: { select?: { name?: string } | null } | undefined
): string | null {
  return value?.select?.name?.trim() || null;
}

export function statusName(
  value: { status?: { name?: string } | null } | undefined
): string | null {
  return value?.status?.name?.trim() || null;
}

export function dateStart(
  value: { date?: { start?: string } | null } | undefined
): string | null {
  return value?.date?.start?.trim() || null;
}

export function peopleIds(
  value: { people?: Array<{ id?: string }> } | undefined
): string[] {
  return (value?.people ?? [])
    .map((person) => person.id?.trim())
    .filter((id): id is string => Boolean(id));
}

export function relationIds(
  value: { relation?: Array<{ id?: string }> } | undefined
): string[] {
  return (value?.relation ?? [])
    .map((entry) => entry.id?.trim())
    .filter((id): id is string => Boolean(id));
}

export async function fetchDatabaseSchema(databaseId: string): Promise<{
  title: string;
  properties: Record<string, { type: string; select?: { options?: Array<{ name: string }> } }>;
}> {
  const data = await notionJson<{
    title?: Array<{ plain_text?: string }>;
    properties?: Record<string, { type: string; select?: { options?: Array<{ name: string }> } }>;
  }>(`/databases/${databaseId}`);

  return {
    title: (data.title ?? []).map((part) => part.plain_text ?? "").join(""),
    properties: data.properties ?? {},
  };
}

export async function ensureLeadsAppUserIdProperty(): Promise<void> {
  const schema = await fetchDatabaseSchema(NOTION_LEADS_DATA_SOURCE_ID);
  if ("App User ID" in schema.properties) return;

  await notionJson(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        "App User ID": { rich_text: {} },
      },
    }),
  });
}

export const APP_SIGNUP_LEAD_SOURCE = "App Signup";

/** Ensures Lead Source select includes "App Signup" for app-created leads. */
export async function ensureLeadSourceAppSignupOption(): Promise<void> {
  const data = await notionJson<{
    properties?: Record<
      string,
      {
        type: string;
        select?: { options?: Array<{ id?: string; name: string; color?: string }> };
      }
    >;
  }>(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}`);

  const leadSource = data.properties?.["Lead Source"];
  if (leadSource?.type !== "select") return;

  const options = leadSource.select?.options ?? [];
  if (options.some((option) => option.name === APP_SIGNUP_LEAD_SOURCE)) return;

  await notionJson(`/databases/${NOTION_LEADS_DATA_SOURCE_ID}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        "Lead Source": {
          select: {
            options: [
              ...options.map((option) => ({
                ...(option.id ? { id: option.id } : {}),
                name: option.name,
                ...(option.color ? { color: option.color } : {}),
              })),
              { name: APP_SIGNUP_LEAD_SOURCE, color: "blue" },
            ],
          },
        },
      },
    }),
  });
}
