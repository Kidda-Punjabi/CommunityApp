import Link from "next/link";
import { BookOpen, ClipboardCheck } from "lucide-react";
import { NavLink } from "@/components/ui/nav-link";
import { getEnglishExamCourseConfig } from "@/lib/learning/english-exam-courses";
import {
  filterEnglishQuestionsByLesson,
  loadEnglishExamMaterials,
  loadEnglishExamQuestions,
} from "@/lib/learning/load-english-exam-content";
import { fetchAccessibleLearnEnglishCourseById } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { pressableClass } from "@/lib/ui/pressable";
import { cn, ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type MaterialsPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function EnglishExamMaterialsPage({
  params,
}: MaterialsPageProps) {
  const { courseId } = await params;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const course = await fetchAccessibleLearnEnglishCourseById(
    session.supabase,
    session.user.id,
    courseId
  );
  const config = course ? getEnglishExamCourseConfig(course.name) : null;
  if (!course || !config) notFound();

  const [materials, questions] = await Promise.all([
    loadEnglishExamMaterials(session.supabase, course.id),
    loadEnglishExamQuestions(session.supabase, course.id),
  ]);

  const showChapterTests = config.kind === "life_in_uk";

  return (
    <div className={ui.page}>
      <NavLink
        href={`/dashboard/english/learn/${course.id}`}
        className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
      >
        ← Back to {course.name}
      </NavLink>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
        Materials
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        {showChapterTests
          ? "Read each chapter sentence by sentence, then test that chapter."
          : "Read each chapter at your own pace. English terms are highlighted."}
      </p>

      <ul className="mt-6 space-y-3">
        {materials.map((material) => {
          const chapterQuestions = filterEnglishQuestionsByLesson(
            questions,
            material.id
          );
          const readHref = `/dashboard/english/learn/${course.id}/materials/${material.id}`;
          const testHref = `/dashboard/english/learn/${course.id}/mock?chapter=${material.id}`;

          return (
            <li
              key={material.id}
              className="rounded-2xl border border-emerald-200 bg-white px-4 py-4"
            >
              <p className="text-sm font-semibold leading-snug text-zinc-900">
                {material.title}
              </p>

              {showChapterTests ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link
                    href={readHref}
                    className={cn(
                      pressableClass,
                      "inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                    )}
                  >
                    <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    Read
                  </Link>
                  {chapterQuestions.length > 0 ? (
                    <Link
                      href={testHref}
                      className={cn(
                        pressableClass,
                        "inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                      )}
                    >
                      <ClipboardCheck
                        className="h-4 w-4 shrink-0"
                        strokeWidth={2.25}
                        aria-hidden
                      />
                      Test ({chapterQuestions.length})
                    </Link>
                  ) : (
                    <span className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-400">
                      Test (0)
                    </span>
                  )}
                </div>
              ) : (
                <Link
                  href={readHref}
                  className={cn(
                    pressableClass,
                    "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                  )}
                >
                  <BookOpen className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                  Read
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
