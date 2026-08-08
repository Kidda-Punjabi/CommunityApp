import { BackLink } from "@/components/navigation/back-link";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";
import Link from "next/link";

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
      <BackLink href="/dashboard/learn">← Back to Learn</BackLink>

      <div className="mb-8 mt-4 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 text-white"
          >
            <path d="M5 4h1a3 3 0 0 1 3 3 3 3 0 0 1 3-3h1" />
            <path d="M13 20h-1a3 3 0 0 1-3-3 3 3 0 0 1-3 3H5" />
            <path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1" />
            <path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7" />
            <path d="M9 7v10" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Learn English</h1>
        <p className="mt-2 text-base text-zinc-600">{privateCourse.name}</p>
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-zinc-900">Coming Soon</h2>
          <p className="mt-2 text-sm text-zinc-600">
            This section is being prepared with learning activities and lessons.
          </p>
          <p className="mt-4 text-sm text-zinc-500">
            Check back soon for interactive English learning content!
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/dashboard/learn"
          className="block w-full rounded-xl bg-emerald-600 px-6 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Return to Learn Hub
        </Link>
      </div>
    </div>
  );
}
