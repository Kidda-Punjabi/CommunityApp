import "server-only";

import {
  PUBLIC_FEEDBACK_COHORT_FALLBACK,
  PUBLIC_FEEDBACK_TUTOR_OPTIONS,
  filterPublicCohortsForAudience,
  mergePublicSelectOptions,
  mergePublicTutorOptions,
  type PublicCohortAudience,
} from "@/lib/public-forms/options";

const NOTION_API_VERSION = "2022-06-28";

type NotionSelectProperty = {
  type?: string;
  select?: { options?: Array<{ name?: string }> };
};

type NotionFeedbackSelects = {
  cohort: string[];
  tutor: string[];
};

async function loadNotionFeedbackSelects(): Promise<NotionFeedbackSelects> {
  const empty = { cohort: [] as string[], tutor: [] as string[] };
  const apiKey = process.env.NOTION_API_KEY?.trim();
  const databaseId = process.env.NOTION_FEEDBACK_DATABASE_ID?.trim();
  if (!apiKey || !databaseId) return empty;

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Notion-Version": NOTION_API_VERSION,
      },
      cache: "no-store",
    });
    if (!response.ok) return empty;

    const data = (await response.json()) as {
      properties?: Record<string, NotionSelectProperty>;
    };
    const names = (property: string) =>
      (data.properties?.[property]?.select?.options ?? [])
        .map((option) => option.name?.trim() ?? "")
        .filter(Boolean);

    return { cohort: names("Cohort"), tutor: names("Tutor") };
  } catch {
    return empty;
  }
}

export async function loadPublicFormSelectOptions(audience: PublicCohortAudience): Promise<{
  cohorts: string[];
  tutors: string[];
}> {
  const live = await loadNotionFeedbackSelects();
  return {
    cohorts: filterPublicCohortsForAudience(
      mergePublicSelectOptions(PUBLIC_FEEDBACK_COHORT_FALLBACK, live.cohort),
      audience
    ),
    tutors: mergePublicTutorOptions(PUBLIC_FEEDBACK_TUTOR_OPTIONS, live.tutor),
  };
}

export async function loadPublicCohortOptions(
  audience: PublicCohortAudience
): Promise<string[]> {
  const { cohorts } = await loadPublicFormSelectOptions(audience);
  return cohorts;
}

export async function loadPublicTutorOptions(): Promise<string[]> {
  const live = await loadNotionFeedbackSelects();
  return mergePublicTutorOptions(PUBLIC_FEEDBACK_TUTOR_OPTIONS, live.tutor);
}
