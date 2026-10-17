import { PlacementTest } from "@/components/community/placement-test";
import { memberHasCommunity } from "@/lib/community/load-home";
import { loadLevelView } from "@/lib/community/level-view";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

export default async function LevelRetakePage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const view = await loadLevelView(admin, user.id);
  if (!view?.unlocked || view.cooldownUntil) redirect("/dashboard/community/level");
  return <PlacementTest mode="retake" />;
}
