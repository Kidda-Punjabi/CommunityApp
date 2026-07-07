/**
 * Shared Notion API helpers — reuses the same token/env pattern as feedback sync.
 */
export const NOTION_API_VERSION = "2022-06-28";

export const NOTION_PACKAGE_DATA_SOURCE_ID =
  process.env.NOTION_PACKAGE_DATA_SOURCE_ID ?? "2a2b5ac4-29c6-80e1-9bfa-000b455fcc0e";

export const NOTION_LEADS_DATA_SOURCE_ID =
  process.env.NOTION_LEADS_DATA_SOURCE_ID ?? "293b5ac4-29c6-8029-9f0a-000b0807ce88";

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
  const response = await notionFetch(path, init);
  const body = await response.text();
  if (!response.ok) {
    throw new NotionApiError(response.status, body);
  }
  return JSON.parse(body) as T;
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
