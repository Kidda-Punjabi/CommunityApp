import { CommunityPageHeader } from "@/components/community/community-page-header";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { ui } from "@/lib/ui/styles";

export default async function CommunityWinsPage() {
  await requireNoKidCommunityAccess();
  return (
    <div className={ui.page}>
      <CommunityPageHeader title="Wins" />
      <p className="mt-3 text-sm text-zinc-700">Level moves and streak milestones from the Community will show up here.</p>
    </div>
  );
}
