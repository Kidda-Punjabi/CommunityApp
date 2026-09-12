import { ParentKidsProgressList } from "@/components/kids/parent-kids-progress-list";
import { BackLink } from "@/components/navigation/back-link";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { loadKidProgressSummariesForParent } from "@/lib/kids/load-kid-progress-summary";
import { ui } from "@/lib/ui/styles";

export default async function KidsProgressPage() {
  const { user, supabase } = await requireNoActiveKidProfile();
  const rows = await loadKidProgressSummariesForParent(supabase, user.id);

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn">← Back to Home</BackLink>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">How your kids are doing</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Homework, attendance, and tutor notes for each child.
        </p>
      </div>
      <ParentKidsProgressList rows={rows} />
    </div>
  );
}
