import { LevelRefresher } from "@/components/community/level-refresher";
import { PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import { memberHasCommunity } from "@/lib/community/load-home";
import { loadLevelView } from "@/lib/community/level-view";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { notFound, redirect } from "next/navigation";

export default async function LevelRefresherPage({ params }: { params: Promise<{ n: string }> }) {
  const level = Number((await params).n);
  if (!Number.isInteger(level) || level < 0 || level > 9) notFound();
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const view = await loadLevelView(admin, user.id);
  if (!view || level >= view.level) redirect("/dashboard/community/level");
  const { data: rows } = await admin
    .from("placement_test_items")
    .select("id, prompt, roman, options")
    .eq("level", level)
    .order("sort_order");
  const items = await Promise.all((rows ?? []).map(async (row) => {
    const { data: clips } = await admin
      .from("placement_test_audio")
      .select("option_id, storage_path")
      .eq("item_id", row.id)
      .eq("voice_id", PUNJABI_LESSON_VOICE_ID)
      .order("created_at", { ascending: false });
    const prompt = (clips ?? []).find((clip) => clip.option_id == null || clip.option_id === "prompt") ?? clips?.[0];
    const signed = prompt ? await admin.storage.from("placement-audio").createSignedUrl(prompt.storage_path as string, 60 * 30) : null;
    return {
      id: row.id as string,
      prompt: row.prompt as string,
      roman: row.roman as string | null,
      audioUrl: signed?.data?.signedUrl ?? null,
      options: ((row.options as { id: string; label: string }[]) ?? []).map((option) => ({ id: option.id, label: option.label })),
    };
  }));
  return (
    <div className="bg-[#F7F5FC] px-4 pt-[max(0.25rem,env(safe-area-inset-top))]">
      <LevelRefresher level={level} items={items} />
    </div>
  );
}
