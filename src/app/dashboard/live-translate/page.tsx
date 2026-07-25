import { LiveTranslateSession } from "@/components/live-translate/live-translate-session";
import { loadLiveTranslateUsage } from "@/lib/live-translate/usage";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LiveTranslatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isPremium = await hasPremiumAccess(supabase, user.id);
  const { client: adminClient } = tryCreateServiceRoleClient();
  const usage = adminClient
    ? await loadLiveTranslateUsage(adminClient, user.id, isPremium)
    : await loadLiveTranslateUsage(supabase, user.id, isPremium);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
      <LiveTranslateSession initialUsage={usage} />
    </div>
  );
}
