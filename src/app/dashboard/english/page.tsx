import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function EnglishHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);
  const privateCourse = privateCourses[0];

  if (!privateCourse) {
    redirect("/dashboard/learn");
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn English</h1>
        <p className="mt-1 text-sm text-zinc-600">{privateCourse.name}</p>
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-900/5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-emerald-600"
            >
              <path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1" />
              <path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5" />
              <path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" />
              <path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" />
              <path d="M9 7v10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">Welcome to English Learning</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Your home for English lessons, practice, and progress tracking.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-900">📚 Content coming soon</p>
            <p className="mt-1 text-xs text-emerald-700">
              Lessons, exercises, and activities will be added here.
            </p>
          </div>
          
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-900">🎮 Practice games</p>
            <p className="mt-1 text-xs text-zinc-600">
              Interactive games to reinforce your learning.
            </p>
          </div>
          
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm font-medium text-zinc-900">📊 Track progress</p>
            <p className="mt-1 text-xs text-zinc-600">
              Monitor your improvement over time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
