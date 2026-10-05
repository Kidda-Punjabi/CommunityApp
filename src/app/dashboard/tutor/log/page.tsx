import { LogLessonFlow } from "@/components/tutor/log-lesson-flow";
import type { CoverTutorChoice } from "@/lib/tutoring/cover-lesson";
import { loadLogLessonCatalog } from "@/lib/tutoring/load-log-lesson-catalog";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { getDisplayName } from "@/lib/profile/display-name";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type LogPageProps = {
  searchParams: Promise<{ cohort?: string; student?: string; includeTest?: string }>;
};

export default async function TutorLogLessonPage({ searchParams }: LogPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) redirect("/dashboard");

  const { client: admin } = tryCreateServiceRoleClient();
  const reader = admin ?? supabase;
  const includeTest = params.includeTest === "1";
  const [{ data: roleRows }, catalog] = await Promise.all([
    reader.from("profile_roles").select("user_id").in("role", ["tutor", "master_admin"]),
    loadLogLessonCatalog(reader, user.id, { includeTest }),
  ]);
  const tutorIds = [...new Set((roleRows ?? []).map((row) => row.user_id as string).filter(Boolean))];
  const [{ data: tutorProfiles }, { data: tutorMaps }] = await Promise.all([
    tutorIds.length
      ? reader.from("profiles").select("id, full_name, preferred_name").in("id", tutorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }> }),
    tutorIds.length
      ? reader.from("notion_tutor_map").select("tutor_id, notion_user_id").in("tutor_id", tutorIds)
      : Promise.resolve({ data: [] as Array<{ tutor_id: string; notion_user_id: string | null }> }),
  ]);
  const linked = new Set(
    (tutorMaps ?? [])
      .filter((row) => (row.notion_user_id ?? "").trim())
      .map((row) => row.tutor_id)
  );
  const tutors: CoverTutorChoice[] = (tutorProfiles ?? [])
    .map((profile) => ({
      id: profile.id,
      name: getDisplayName(profile) || "Tutor",
      notionLinked: linked.has(profile.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

  return (
    <LogLessonFlow
      catalog={catalog}
      today={today}
      initialCohortId={params.cohort?.trim() || null}
      initialPackageId={params.student?.trim() || null}
      userId={user.id}
      tutors={tutors}
      includeTest={includeTest}
    />
  );
}
