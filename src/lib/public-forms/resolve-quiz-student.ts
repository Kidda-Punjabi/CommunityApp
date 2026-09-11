import { relationIds } from "@/lib/notion/client";
import { matchTutorName } from "@/lib/feedback/load-feedback-context";
import { getStaffFacingName } from "@/lib/profile/display-name";
import { cohortSelectFromPackageName } from "@/lib/public-forms/quiz-notion";
import type { SupabaseClient } from "@supabase/supabase-js";

const NOTION_API_VERSION = "2022-06-28";

const PACKAGE_STATUS_RANK: Record<string, number> = {
  in_progress: 0,
  classes_completed: 1,
  offboarding_complete: 2,
};

export type QuizPackageCandidate = {
  name: string;
  status: string;
  course_id: string | null;
  tutor_id: string | null;
};

export function pickBestPackageForQuiz(
  rows: QuizPackageCandidate[],
  courseId: string
): QuizPackageCandidate | null {
  if (rows.length === 0) return null;

  return [...rows].sort((a, b) => {
    const aScore =
      (a.course_id === courseId ? 0 : 10) + (PACKAGE_STATUS_RANK[a.status] ?? 3);
    const bScore =
      (b.course_id === courseId ? 0 : 10) + (PACKAGE_STATUS_RANK[b.status] ?? 3);
    return aScore - bScore;
  })[0]!;
}

async function fetchLeadPackagePageIds(leadPageId: string): Promise<string[]> {
  const apiKey = process.env.NOTION_API_KEY?.trim();
  if (!apiKey) return [];

  const response = await fetch(`https://api.notion.com/v1/pages/${leadPageId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Notion-Version": NOTION_API_VERSION,
    },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    properties?: Record<string, { relation?: Array<{ id?: string }> }>;
  };
  return relationIds(data.properties?.Packages);
}

/**
 * Public quiz takers are enrolled students. Resolve Test Scores Cohort/Tutor
 * from their Notion lead → package, without blocking on lookup failure.
 */
export async function resolveQuizStudentNotionFields(
  supabase: SupabaseClient,
  email: string,
  courseId: string
): Promise<{ cohort: string | null; tutor: string | null }> {
  const empty = { cohort: null, tutor: null };
  const normalized = email.trim();
  if (!normalized) return empty;

  try {
    const { data: leads, error: leadError } = await supabase
      .from("notion_leads_cache")
      .select("notion_page_id")
      .ilike("email", normalized);

    if (leadError || !leads?.length) return empty;

    const packagePageIds = [
      ...new Set(
        (
          await Promise.all(leads.map((lead) => fetchLeadPackagePageIds(lead.notion_page_id)))
        ).flat()
      ),
    ];
    if (packagePageIds.length === 0) return empty;

    const { data: packages, error: packageError } = await supabase
      .from("package_instances")
      .select("name, status, course_id, tutor_id")
      .in("notion_page_id", packagePageIds);

    if (packageError || !packages?.length) return empty;

    const best = pickBestPackageForQuiz(packages, courseId);
    if (!best) return empty;

    let tutor: string | null = null;
    if (best.tutor_id) {
      const { data: tutorProfile } = await supabase
        .from("profiles")
        .select("full_name, preferred_name")
        .eq("id", best.tutor_id)
        .maybeSingle();
      const { notionTutor } = matchTutorName(
        getStaffFacingName(tutorProfile),
        tutorProfile?.full_name,
        tutorProfile?.preferred_name
      );
      tutor = notionTutor;
    }

    return {
      cohort: cohortSelectFromPackageName(best.name),
      tutor,
    };
  } catch (error) {
    console.error(
      "[public quiz notion] student lookup failed",
      error instanceof Error ? error.message : error
    );
    return empty;
  }
}
