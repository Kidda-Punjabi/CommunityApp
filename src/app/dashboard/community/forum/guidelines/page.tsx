import { ForumGuidelinesAgreementForm } from "@/components/forum/forum-guidelines-agreement-form";
import { ForumGuidelinesContent } from "@/components/forum/forum-guidelines-content";
import { canAccessForum, loadForumGuidelinesAgreement } from "@/lib/forum/access";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ForumGuidelinesPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  if (!(await canAccessForum(supabase, user.id))) {
    redirect("/dashboard/community/forum");
  }

  const hasAgreed = await loadForumGuidelinesAgreement(supabase, user.id);

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/community/forum"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to forum
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">Community guidelines</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Please read these before posting in the forum.
      </p>

      <div className="mt-6">
        {hasAgreed ? (
          <div className={ui.stackLoose}>
            <div className={ui.cardBordered}>
              <ForumGuidelinesContent />
            </div>
            <p className="text-sm text-emerald-700">
              You have already accepted the guidelines.{" "}
              <Link href="/dashboard/community/forum/new" className="font-semibold underline">
                Create a post
              </Link>
            </p>
          </div>
        ) : (
          <ForumGuidelinesAgreementForm />
        )}
      </div>
    </div>
  );
}
