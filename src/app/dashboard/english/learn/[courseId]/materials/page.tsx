import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";
import { getEnglishExamCourseConfig } from "@/lib/learning/english-exam-courses";
import { loadEnglishExamMaterials } from "@/lib/learning/load-english-exam-content";
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
  if (!course || !getEnglishExamCourseConfig(course.name)) notFound();

  const materials = await loadEnglishExamMaterials(session.supabase, course.id);

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
        Read each chapter at your own pace. English terms are highlighted.
      </p>

      <ul className="mt-6 space-y-3">
        {materials.map((material) => (
          <li key={material.id}>
            <Link
              href={`/dashboard/english/learn/${course.id}/materials/${material.id}`}
              className={cn(
                pressableClass,
                "block rounded-2xl border border-emerald-200 bg-white px-4 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
              )}
            >
              <p className="text-sm font-semibold text-zinc-900">{material.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {material.audioScript
                  ? "Open chapter"
                  : "No text yet"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
