import { PhotoTranslateSession } from "@/components/photo-translate/photo-translate-session";
import { HubCard } from "@/components/ui/hub-primitives";
import { canAccessPhotoTranslate } from "@/lib/photo-translate/access";
import { loadPhotoTranslateUsage } from "@/lib/photo-translate/usage";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PhotoTranslatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessPhotoTranslate(access)) {
    return (
      <div className="space-y-6 px-4 py-6">
        <HubCard>
          <h1 className="text-xl font-bold text-zinc-900">Photo Translate</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Photo Translate is included with paid Kidda plans. Upgrade to scan real-world Punjabi
            signs and menus.
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
    ? await loadPhotoTranslateUsage(adminClient, user.id)
    : await loadPhotoTranslateUsage(supabase, user.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-4 py-6">
      <PhotoTranslateSession initialUsage={usage} />
    </div>
  );
}
