import { BackLink } from "@/components/navigation/back-link";
import { ResourceListSection } from "@/components/resources/resource-list-section";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function LearnResourcesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  return (
    <div className={ui.page}>
      <BackLink fallbackHref="/dashboard/learn">← Back to Learn</BackLink>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Resources</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tools, reference, and shortcuts for practice and progress.
        </p>
      </div>

      <ResourceListSection showLiveTranslate showPhotoTranslate />
    </div>
  );
}
