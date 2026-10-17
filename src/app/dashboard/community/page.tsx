import { CommunityTab } from "@/components/community/community-tab";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { isNativeAppRequest } from "@/lib/native/platform";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CommunityPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  const allowed = await memberHasCommunity(admin, user.id);
  const native = isNativeAppRequest(await headers());

  return (
    <div className={`${ui.page} !py-4`}>
      <h1 className="mb-3 font-heading text-2xl font-bold tracking-tight text-zinc-900">Community</h1>
      {allowed ? (
        <CommunityHome userId={user.id} />
      ) : (
        <section className={ui.card}>
          <p className="text-sm text-zinc-700">
            {native ? "This isn't on your account." : "Community sessions are for Kidda Community members."}
          </p>
          <Link href="/dashboard/community/forum" className="mt-4 inline-flex text-sm font-semibold text-violet-700">
            Community forum
          </Link>
        </section>
      )}
    </div>
  );
}

async function CommunityHome({ userId }: { userId: string }) {
  const admin = createServiceRoleClient();
  const home = await loadCommunityHome(admin, userId);
  if (!home.mainSessionId || home.level == null) redirect("/dashboard/community/welcome");
  return <CommunityTab home={home} />;
}
