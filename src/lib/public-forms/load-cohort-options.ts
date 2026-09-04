import "server-only";

import { PUBLIC_FEEDBACK_COHORT_FALLBACK } from "@/lib/public-forms/options";

const NOTION_API_VERSION = "2022-06-28";

export async function loadPublicCohortOptions(): Promise<string[]> {
  const apiKey = process.env.NOTION_API_KEY?.trim();
  const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID?.trim();
  if (!apiKey || !databaseId) {
    return [...PUBLIC_FEEDBACK_COHORT_FALLBACK];
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_API_VERSION,
      },
      cache: "no-store",
    });
    if (!response.ok) return [...PUBLIC_FEEDBACK_COHORT_FALLBACK];

    const data = (await response.json()) as {
      properties?: Record<string, { type?: string; select?: { options?: Array<{ name?: string }> } }>;
    };
    const names = (data.properties?.Cohort?.select?.options ?? [])
      .map((option) => option.name?.trim() ?? "")
      .filter(Boolean);

    return names.length > 0 ? names : [...PUBLIC_FEEDBACK_COHORT_FALLBACK];
  } catch {
    return [...PUBLIC_FEEDBACK_COHORT_FALLBACK];
  }
}
