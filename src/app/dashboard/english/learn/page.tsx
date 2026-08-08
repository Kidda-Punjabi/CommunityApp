import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function EnglishLearnPage() {
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
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn</h1>
        <p className="mt-1 text-sm text-zinc-600">English lessons and courses</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-900/5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6 text-emerald-600"
              >
                <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Course Lessons</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Structured lessons to build your English skills
              </p>
              <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                Content will be added here
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-900/5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6 text-amber-600"
              >
                <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Vocabulary</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Build your word bank with essential vocabulary
              </p>
              <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                Flashcards and word lists coming soon
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-900/5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6 text-sky-600"
              >
                <path d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Conversations</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Practice real-world English conversations
              </p>
              <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                Interactive dialogues coming soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
