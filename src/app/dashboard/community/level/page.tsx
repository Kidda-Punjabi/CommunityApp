import { YourLevel } from "@/components/community/level-screen";
import { loadLevelView } from "@/lib/community/level-view";
import { memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityLevelPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const view = await loadLevelView(admin, user.id);
  if (!view) {
    return (
      <div className={`${ui.page} bg-[#F7F5FC] font-[family-name:var(--font-community)]`}>
        <Link href="/dashboard/community" className="text-sm font-semibold text-[#4A3F66]">Back</Link>
        <h1 className="mt-2 font-heading text-2xl font-extrabold">Your level</h1>
        <Link href="/dashboard/community/placement" className="mt-4 flex h-14 items-center justify-center rounded-[18px] bg-[#7C3AED] font-bold text-white">Take the 2-minute test</Link>
      </div>
    );
  }
  return <YourLevel view={view} />;
}
