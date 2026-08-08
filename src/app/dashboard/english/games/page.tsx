import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

const PLACEHOLDER_GAMES = [
  {
    title: "Memory Match",
    description: "Match English words with their meanings",
  },
  {
    title: "Speed Quiz",
    description: "Test your knowledge against the clock",
  },
  {
    title: "Sentence Builder",
    description: "Arrange words to form correct sentences",
  },
  {
    title: "Speaking Practice",
    description: "Improve pronunciation with voice recognition",
  },
] as const;

export default async function EnglishGamesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const privateCourses = await fetchAccessiblePrivateCourses(
    session.supabase,
    session.user.id
  );

  if (privateCourses.length === 0) {
    redirect("/dashboard/profile");
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Games</h1>
        <p className="mt-1 text-sm text-zinc-600">Practice English through games</p>
      </div>

      <div className="grid gap-4">
        {PLACEHOLDER_GAMES.map((game) => (
          <div
            key={game.title}
            className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-sm"
          >
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
                  <path d="M6.5 8.25h11A3.75 3.75 0 0 1 21.25 12v1.25A3.75 3.75 0 0 1 17.5 17H6.5A3.75 3.75 0 0 1 2.75 13.25V12A3.75 3.75 0 0 1 6.5 8.25Z" />
                  <path d="M8 10.75v3.5M6.25 12.5h3.5" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-zinc-900">{game.title}</h2>
                <p className="mt-1 text-sm text-zinc-600">{game.description}</p>
                <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-emerald-800">
                  Coming soon
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
