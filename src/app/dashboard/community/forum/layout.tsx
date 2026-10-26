import { CommunityLocked } from "@/components/community/community-locked";
import { memberHasCommunity } from "@/lib/community/load-home";
import { isNativeAppRequest } from "@/lib/native/platform";
import { headers } from "next/headers";
import { requireForumAccessAllowed } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export default async function ForumLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireForumAccessAllowed();
  const allowed = await memberHasCommunity(createServiceRoleClient(), user.id);
  if (!allowed) {
    return (
      <div className={`${ui.page} flex min-h-[70dvh] flex-col`}>
        <CommunityLocked native={isNativeAppRequest(await headers())} />
      </div>
    );
  }
  return children;
}
