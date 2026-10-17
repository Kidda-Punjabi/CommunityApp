import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { levelFillVar, levelLabel } from "@/lib/community/levels";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityPodPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  return (
    <div className={ui.page}>
      <Link href="/dashboard/community" className="text-sm font-semibold text-violet-700">Community</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">{home.pod ? `You're in ${home.pod.name}` : "Your pod"}</h1>
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
