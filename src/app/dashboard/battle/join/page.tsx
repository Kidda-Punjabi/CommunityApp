import Link from "next/link";
import { BattleJoinForm } from "@/components/battle/battle-join-form";
import { ui } from "@/lib/ui/styles";

export default function BattleJoinPage() {
  return (
    <div className={ui.page}>
      <BattleJoinForm />
      <Link href="/dashboard/battle/create" className={`mt-6 inline-block ${ui.btnGhost}`}>
        Or create your own battle
      </Link>
    </div>
  );
}
