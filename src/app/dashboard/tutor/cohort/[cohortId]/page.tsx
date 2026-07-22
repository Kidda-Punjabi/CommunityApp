import { TutorLessonManager } from "@/components/tutor/tutor-lesson-manager";
import { loadTutorCohortLessons } from "@/lib/tutoring/load-tutor-dashboard";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

type TutorCohortPageProps = {
  params: Promise<{ cohortId: string }>;
};

export default async function TutorCohortPage({ params }: TutorCohortPageProps) {
  const { cohortId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await loadTutorCohortLessons(supabase, user!.id, cohortId);
  if (!data) {
    redirect("/dashboard/tutor?error=cohort-access");
  }

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/tutor/lessons"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to lessons
      </Link>

      <div className="mb-8 mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {data.courseName} · Group
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          {data.cohortName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Unlocks apply to all {data.members.length} student
          {data.members.length === 1 ? "" : "s"} in this cohort.
        </p>
        <Link
          href={`/dashboard/tutor/log-lesson?cohortId=${cohortId}`}
          className="mt-3 inline-flex text-sm font-semibold text-violet-600 hover:text-violet-500"
        >
          Log this lesson →
        </Link>
      </div>

      {data.members.length > 0 && (
        <div className={`${ui.cardBordered} mb-6`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Students in cohort
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {data.members.map((member) => (
              <li
                key={member.userId}
                className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800"
              >
                {member.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      <TutorLessonManager
        lessons={data.lessons}
        scope={{ mode: "cohort", cohortId }}
        scopeLabel={`everyone in ${data.cohortName}`}
      />
    </div>
  );
}
