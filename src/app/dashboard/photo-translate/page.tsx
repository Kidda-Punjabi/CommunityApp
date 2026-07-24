import { PhotoTranslateSession } from "@/components/photo-translate/photo-translate-session";
import { loadPhotoTranslateUsage } from "@/lib/photo-translate/usage";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PhotoTranslatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { client: adminClient } = tryCreateServiceRoleClient();
  const client = adminClient ?? supabase;
  const isPremium = await hasPremiumAccess(client, user.id);
  const usage = await loadPhotoTranslateUsage(client, user.id, isPremium);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
      <PhotoTranslateSession initialUsage={usage} />
    </div>
  );
}
