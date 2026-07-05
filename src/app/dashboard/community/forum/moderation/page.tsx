import { ForumModerationTab } from "@/components/forum/forum-moderation-tab";
import { canModerateForum } from "@/lib/forum/access";
import { loadOpenForumReports } from "@/lib/forum/load-forum";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ForumModerationPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  if (!(await canModerateForum(supabase, user.id))) {
    redirect("/dashboard/community/forum");
  }

  const reports = await loadOpenForumReports(supabase);

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/community/forum"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to forum
      </Link>
      <div className="mt-4">
        <ForumModerationTab reports={reports} />
      </div>
    </div>
  );
}
