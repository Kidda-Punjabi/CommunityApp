import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityWinsPage() {
  await requireNoKidCommunityAccess();
  return (
    <div className={ui.page}>
      <Link href="/dashboard/community" className="text-sm font-semibold text-violet-700">Community</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">Wins</h1>
      <p className="mt-3 text-sm text-zinc-700">Level moves and streak milestones from the Community will show up here.</p>
    </div>
  );
}
