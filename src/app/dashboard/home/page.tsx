import { FreeLessonsPath } from "@/components/learn/free-lessons-path";
import { HubCard } from "@/components/ui/hub-primitives";
import { getHomeTabData } from "@/lib/cache/tab-page-cache";
import { loadEverydayPunjabiPathItems } from "@/lib/free-lessons/load-path-items";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  const [{ dashboard }, pathItems] = await Promise.all([
    getHomeTabData(session.user.id),
    loadEverydayPunjabiPathItems(supabase, session.user.id),
  ]);

  return (
    <div className={ui.page}>
      <section className={ui.section}>
        <div className="mb-5 text-center">
          <h1 className="font-heading text-2xl font-semibold text-zinc-900">
            Everyday Punjabi
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Finish each topic to unlock the next.
          </p>
        </div>
        {pathItems.length > 0 ? (
          <FreeLessonsPath items={pathItems} />
        ) : (
          <p className="text-center text-sm text-zinc-500">Topics coming soon.</p>
        )}
      </section>

      {dashboard.isFreeTier ? (
        <section className={ui.section}>
          <HubCard>
            <h2 className="text-lg font-medium text-zinc-900">
              Unlock the full Foundational course
            </h2>
            <p className="mt-2 text-sm text-zinc-500">
              Go beyond Everyday Punjabi with pronunciation, core vocabulary, and
              guided lessons at your own pace.
            </p>
            <Link href="/courses" className={`mt-4 ${ui.btnPrimary}`}>
              View courses
            </Link>
          </HubCard>
        </section>
      ) : null}
    </div>
  );
}
