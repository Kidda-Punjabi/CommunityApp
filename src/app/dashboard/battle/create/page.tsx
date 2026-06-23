import { BattleCreateForm } from "@/components/battle/battle-create-form";
import { ui } from "@/lib/ui/styles";

export default function BattleCreatePage() {
  return (
    <div className={ui.page}>
      <BattleCreateForm />
    </div>
  );
}
