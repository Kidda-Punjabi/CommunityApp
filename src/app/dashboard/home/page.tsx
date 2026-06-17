import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { count: lessonCount }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, membership_tier")
      .eq("id", user!.id)
      .single(),
    supabase.from("lessons").select("*", { count: "exact", head: true }),
  ]);

  const displayName =
    profile?.full_name || user?.user_metadata?.full_name || "there";

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <p className="text-sm font-medium text-violet-600">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">
          Hi, {displayName}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {lessonCount
            ? `${lessonCount} lesson${lessonCount === 1 ? "" : "s"} ready to explore`
            : "Your learning journey starts on the Learn tab."}
        </p>
      </div>

      <Link
        href="/dashboard/learn"
        className="rounded-2xl bg-violet-600 px-5 py-4 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-500"
      >
        Go to Learn
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Membership
          </p>
          <p className="mt-1 text-lg font-semibold capitalize text-violet-600">
            {profile?.membership_tier ?? "free"}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Lessons
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {lessonCount ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}
