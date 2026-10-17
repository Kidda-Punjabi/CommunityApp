import { LevelDetail } from "@/components/community/level-screen";
import { memberHasCommunity } from "@/lib/community/load-home";
import { loadLevelExample, loadLevelView } from "@/lib/community/level-view";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { notFound, redirect } from "next/navigation";

export default async function LevelDetailPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const level = Number(n);
  if (!Number.isInteger(level) || level < 0 || level > 9) notFound();
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const view = await loadLevelView(admin, user.id);
  if (!view) redirect("/dashboard/community/placement");
  const [example, history] = await Promise.all([
    loadLevelExample(admin, level),
    admin.from("kidda_level_history").select("to_level, created_at").eq("user_id", user.id).order("created_at"),
  ]);
  const passed = (history.data ?? []).find((row) => (row.to_level as number) > level);
  return <LevelDetail view={view} n={level} example={example} passedOn={(passed?.created_at as string | undefined) ?? null} />;
}
