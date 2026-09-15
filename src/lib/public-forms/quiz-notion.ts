const NOTION_API_VERSION = "2022-06-28";
/** Notion API 2022-06-28 parent.database_id — not the data-source id. */
const DEFAULT_TEST_SCORES_DATABASE_ID = "334b5ac4-29c6-80f7-8a39-fa3dcc73d89e";
/** Collection data-source id (Notion 2025+). Passing this as database_id 404s. */
const TEST_SCORES_DATA_SOURCE_ID = "334b5ac4-29c6-803d-9c25-000b060b3061";
const TEST_SCORES_COURSE_OPTIONS = new Set(["Beginners Course"]);

type NotionPropertyValue =
  | { title: Array<{ text: { content: string } }> }
  | { rich_text: Array<{ text: { content: string } }> }
  | { select: { name: string } }
  | { number: number }
  | { date: { start: string } };

export type PublicQuizNotionFields = {
  fullName: string;
  email: string;
  courseName: string;
  studentScore: number;
  maxScore: number;
  submittedAt: Date;
  cohort?: string | null;
  week?: string | null;
  tutor?: string | null;
};

/** Invert quizScorePercent: stored 0–100 → raw correct count for Test Scores. */
export function studentScoreFromPercent(percent: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((percent / 100) * maxScore);
}

/** Recap quizzes map to Test Scores Week selects like "Week 8". Checkpoints have no single week. */
export function weekSelectFromQuizTitle(title: string): string | null {
  const recap = /^Week (\d+) Recap Quiz$/i.exec(title.trim());
  return recap ? `Week ${recap[1]}` : null;
}

/** Test Scores Cohort select: "Cohort 42", "Kids Circle 1", or "1-1 Class". */
export function cohortSelectFromPackageName(name: string): string | null {
  const trimmed = name.trim();
  const kids = trimmed.match(/kids\s*circle\s*(\d+)/i);
  if (kids) return `Kids Circle ${kids[1]}`;
  const cohort = trimmed.match(/cohort\s*(\d+)/i);
  if (cohort) return `Cohort ${cohort[1]}`;
  if (/\b1\s*-\s*1\b|\bone[\s-]?to[\s-]?one\b/i.test(trimmed)) return "1-1 Class";
  return null;
}

export function buildNotionTestScoreProperties(
  fields: PublicQuizNotionFields
): Record<string, NotionPropertyValue> {
  const properties: Record<string, NotionPropertyValue> = {
    Name: {
      title: [{ text: { content: fields.fullName } }],
    },
    Email: {
      rich_text: [{ text: { content: fields.email } }],
    },
    "Student Score": { number: fields.studentScore },
    "Max Score": { number: fields.maxScore },
    Date: {
      date: { start: fields.submittedAt.toISOString() },
    },
  };

  const course = fields.courseName.trim();
  if (TEST_SCORES_COURSE_OPTIONS.has(course)) {
    properties.Course = { select: { name: course } };
  }

  if (fields.cohort?.trim()) {
    properties.Cohort = { select: { name: fields.cohort.trim() } };
  }
  if (fields.week?.trim()) {
    properties.Week = { select: { name: fields.week.trim() } };
  }
  if (fields.tutor?.trim()) {
    properties.Tutor = { select: { name: fields.tutor.trim() } };
  }

  return properties;
}

export function resolveTestScoresDatabaseId(configuredId?: string | null): string {
  const id = configuredId?.trim() || DEFAULT_TEST_SCORES_DATABASE_ID;
  return id === TEST_SCORES_DATA_SOURCE_ID ? DEFAULT_TEST_SCORES_DATABASE_ID : id;
}

export async function createNotionTestScorePage(
  properties: Record<string, NotionPropertyValue>
): Promise<{ pageId: string }> {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = resolveTestScoresDatabaseId(
    process.env.NOTION_TEST_SCORES_DATA_SOURCE_ID
  );

  if (!apiKey || !databaseId) {
    throw new Error("Notion Test Scores integration is not configured.");
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
