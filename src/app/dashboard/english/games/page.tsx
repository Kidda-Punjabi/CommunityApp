import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function EnglishGamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);

  if (privateCourses.length === 0) {
    redirect("/dashboard/learn");
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-600">Practice English through games</p>
      </div>

      <div className="grid gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-sm ring-1 ring-violet-900/5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6 text-violet-600"
              >
                <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Memory Match</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Match English words with their meanings
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-zinc-500">
                Coming soon
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 p-6 shadow-sm ring-1 ring-rose-900/5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-6 w-6 text-rose-600"
              >
                <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Speed Quiz</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Test your knowledge against the clock
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-zinc-500">
                Coming soon
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm ring-1 ring-amber-900/5">
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
                <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Sentence Builder</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Arrange words to form correct sentences
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-zinc-500">
                Coming soon
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 p-6 shadow-sm ring-1 ring-sky-900/5">
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
                <path d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-zinc-900">Speaking Practice</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Improve pronunciation with voice recognition
              </p>
              <div className="mt-3 rounded-lg bg-white/60 px-3 py-2 text-xs text-zinc-500">
                Coming soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
