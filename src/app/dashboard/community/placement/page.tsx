import { PlacementTest } from "@/components/community/placement-test";
import { memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export default async function PlacementPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { user } = await requireNoKidCommunityAccess();
  const { from } = await searchParams;
  const fromPractice = from === "practice" || !(await memberHasCommunity(createServiceRoleClient(), user.id));
  return (
    <div className={`${ui.page} !py-4`}>
      <PlacementTest fromPractice={fromPractice} />
    </div>
  );
}
