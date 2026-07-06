import { StickerBook } from "@/components/kids/sticker-book";
import { loadKidSession } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function KidsStickersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  const kid = session.activeKidProfile;
  if (!kid) redirect("/dashboard/profile/kids");

  const { data: stickers } = await supabase
    .from("kid_stickers")
    .select("*")
    .eq("kid_profile_id", kid.id)
    .order("earned_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-bold text-sky-900">My stickers</h1>
      <p className="mt-1 text-sm text-sky-700">
        {stickers?.length ?? 0} collected — keep playing to find them all!
      </p>
      <div className="mt-6">
        <StickerBook earned={stickers ?? []} />
      </div>
    </div>
  );
}
