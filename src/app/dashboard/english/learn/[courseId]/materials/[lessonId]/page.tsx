import { renderEnglishMaterialScript } from "@/components/english/english-material-script";
import { NavLink } from "@/components/ui/nav-link";
import { getEnglishExamCourseConfig } from "@/lib/learning/english-exam-courses";
import { loadEnglishExamMaterials } from "@/lib/learning/load-english-exam-content";
import { fetchAccessibleLearnEnglishCourseById } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type MaterialChapterPageProps = {
  params: Promise<{ courseId: string; lessonId: string }>;
};

export default async function EnglishExamMaterialChapterPage({
  params,
}: MaterialChapterPageProps) {
  const { courseId, lessonId } = await params;
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const course = await fetchAccessibleLearnEnglishCourseById(
    session.supabase,
    session.user.id,
    courseId
  );
  if (!course || !getEnglishExamCourseConfig(course.name)) notFound();

  const materials = await loadEnglishExamMaterials(session.supabase, course.id);
  const material = materials.find((item) => item.id === lessonId);
  if (!material) notFound();

  return (
    <div className={ui.page}>
      <NavLink
        href={`/dashboard/english/learn/${course.id}/materials`}
        className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
      >
        ← All materials
      </NavLink>

      <h1 className="mt-4 text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
        {material.title}
      </h1>

      <article className="mt-6 rounded-2xl border border-emerald-200 bg-white px-4 py-5 sm:px-5">
        {renderEnglishMaterialScript(material.audioScript)}
      </article>
    </div>
  );
}
