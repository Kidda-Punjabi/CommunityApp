import Link from "next/link";
import { BattleJoinForm } from "@/components/battle/battle-join-form";
import { ui } from "@/lib/ui/styles";

type BattleJoinPageProps = {
  params: Promise<{ code: string }>;
};

export default async function BattleJoinByCodePage({ params }: BattleJoinPageProps) {
  const { code } = await params;

  return (
    <div className={ui.page}>
      <BattleJoinForm initialCode={code} />
      <Link href="/dashboard/battle/create" className={`mt-6 inline-block ${ui.btnGhost}`}>
        Or create your own battle
      </Link>
    </div>
  );
}
