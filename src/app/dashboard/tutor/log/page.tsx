import { LogLessonFlow } from "@/components/tutor/log-lesson-flow";
import { loadLogLessonCatalog } from "@/lib/tutoring/load-log-lesson-catalog";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
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
  const catalog = await loadLogLessonCatalog(admin ?? supabase, user.id, {
    includeTest: params.includeTest === "1",
  });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

  return (
    <LogLessonFlow
      catalog={catalog}
      today={today}
      initialCohortId={params.cohort?.trim() || null}
      initialPackageId={params.student?.trim() || null}
    />
  );
}
