import { EverydayPunjabiPractice } from "@/components/practise/previous-practise";
import { PractiseApp } from "@/components/practise/practise-app";
import { FindYourLevel } from "@/components/practise/find-your-level";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { loadPractiseHome } from "@/lib/practise/load-home";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");
  const { view } = await searchParams;

  const supabase = await createClient();
  const actor = await resolveCourseActor(supabase, session.user.id);

  // Kid profiles keep the existing page: Kidda Levels are for adult accounts.
  if (actor.kind === "kid") return <EverydayPunjabiPractice userId={session.user.id} />;

  if (view === "previous") {
    return (
      <EverydayPunjabiPractice
        userId={session.user.id}
        backLink={
          <Link href="/dashboard/home" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">
            ← Back to Practise
          </Link>
        }
      />
    );
  }

  const { data: profile } = await supabase.from("profiles").select("kidda_level").eq("id", session.user.id).maybeSingle();
  const level = profile?.kidda_level as number | null | undefined;
  if (level == null) return <FindYourLevel />;

  const home = await loadPractiseHome(supabase, createServiceRoleClient(), session.user.id, level);
  return <PractiseApp home={home} />;
}
