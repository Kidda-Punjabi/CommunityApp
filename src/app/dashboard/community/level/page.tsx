import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { levelFillVar, levelInkVar, levelLabel } from "@/lib/community/levels";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { CommunityPageHeader } from "@/components/community/community-page-header";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityLevelPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  return (
    <div className={ui.page}>
      <CommunityPageHeader title="Your level" />
      {home.level == null ? (
        <Link href="/dashboard/community/placement" className={`${ui.btnPrimary} mt-4`}>Take the 2-minute test</Link>
      ) : (
        <p className="mt-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold" style={{ background: levelFillVar(home.level), color: levelInkVar(home.level) }}>
          {levelLabel(home.level)}
        </p>
      )}
      <div className="mt-6 grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, level) => (
          <span key={level} className="flex h-10 items-center justify-center rounded-full text-sm font-semibold" style={{ background: levelFillVar(level), color: levelInkVar(level), outline: level === home.level ? "2px solid #18181b" : undefined }}>
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
