import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { levelFillVar, levelLabel } from "@/lib/community/levels";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { CommunityPageHeader } from "@/components/community/community-page-header";
import { ui } from "@/lib/ui/styles";

export default async function CommunityPodPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  return (
    <div className={ui.page}>
      <CommunityPageHeader title={home.pod ? `You're in ${home.pod.name}` : "Your pod"} />
      <ul className="mt-4 space-y-3">
        {home.podmates.map((mate) => (
          <li key={mate.userId} className="flex min-h-11 items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold" style={mate.level == null ? undefined : { boxShadow: `0 0 0 3px ${levelFillVar(mate.level)}` }}>
              {mate.name.slice(0, 1)}
            </span>
            <span>
              <span className="block text-sm font-semibold text-zinc-900">{mate.name}</span>
              {mate.level != null ? <span className="text-xs text-zinc-500">{levelLabel(mate.level)}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
