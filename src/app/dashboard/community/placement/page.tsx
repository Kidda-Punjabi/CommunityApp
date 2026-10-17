import { PlacementTest } from "@/components/community/placement-test";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { ui } from "@/lib/ui/styles";

export default async function PlacementPage() {
  await requireNoKidCommunityAccess();
  return (
    <div className={`${ui.page} !py-4`}>
      <PlacementTest />
    </div>
  );
}
