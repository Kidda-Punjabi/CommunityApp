import "server-only";

import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { memberHasCommunity } from "@/lib/community/load-home";
import { rejectIfKidCommunityBlocked } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export async function requireCommunityMember() {
  const blocked = await rejectIfKidCommunityBlocked();
  if (blocked.blocked) return { error: blocked.error as string };
  const admin = createServiceRoleClient();
  const allowed = await memberHasCommunity(admin, blocked.user.id);
  if (!allowed) return { error: "This isn't on your account." };
  return { userId: blocked.user.id, admin };
}

export async function requireCommunityStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await canAccessAdminPanel(user, supabase))) {
    return { error: "Unauthorized" };
  }
  return { userId: user.id, admin: createServiceRoleClient() };
}
