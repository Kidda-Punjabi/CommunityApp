import { LiveTranslateSession } from "@/components/live-translate/live-translate-session";
import { HubCard } from "@/components/ui/hub-primitives";
import { canAccessLiveTranslate } from "@/lib/live-translate/access";
import { loadLiveTranslateUsage } from "@/lib/live-translate/usage";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LiveTranslatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessLiveTranslate(access)) {
    return (
      <div className="space-y-6 px-4 py-6">
        <HubCard>
          <h1 className="text-xl font-bold text-zinc-900">Live Translate</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Live Translate is included with paid Kidda plans. Upgrade to unlock real-time Punjabi ↔
            English conversations.
          </p>
          <Link
            href="/courses"
            className="mt-4 inline-flex rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            View courses
          </Link>
        </HubCard>
      </div>
    );
  }

  const { client: adminClient } = tryCreateServiceRoleClient();
  const usage = adminClient
    ? await loadLiveTranslateUsage(adminClient, user.id)
    : await loadLiveTranslateUsage(supabase, user.id);

  return (
    <div className="px-4 py-6">
      <LiveTranslateSession initialUsage={usage} />
    </div>
  );
}
