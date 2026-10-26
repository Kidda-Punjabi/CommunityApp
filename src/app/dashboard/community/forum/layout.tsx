import { memberHasCommunity } from "@/lib/community/load-home";
import { requireForumAccessAllowed } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export default async function ForumLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireForumAccessAllowed();
  const allowed = await memberHasCommunity(createServiceRoleClient(), user.id);
  if (!allowed) {
    return (
      <div className={ui.page}>
        <section className={ui.card}>
          <p className="text-sm text-zinc-700">Community sessions are only for Kidda Community members.</p>
        </section>
      </div>
    );
  }
  return children;
}
