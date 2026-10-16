import { NewForumPostForm } from "@/components/forum/new-forum-post-form";
import {
  canAccessForum,
  loadForumOnboardingState,
} from "@/lib/forum/access";
import { viewerForumSuspended } from "@/lib/forum/load-forum";
import { FORUM_SUSPENDED_MESSAGE } from "@/lib/forum/safety";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NewForumPostPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  if (!(await canAccessForum(supabase, user.id))) {
    redirect("/dashboard/community/forum");
  }

  if (await viewerForumSuspended(supabase, user.id)) {
    return (
      <div className={ui.page}>
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {FORUM_SUSPENDED_MESSAGE}
        </p>
      </div>
    );
  }

  const onboarding = await loadForumOnboardingState(supabase, user.id);
  if (!onboarding.hasAgreedGuidelines) {
    redirect("/dashboard/community/forum/guidelines");
  }
  if (!onboarding.hasCompletedIntro) {
    redirect("/dashboard/community/forum/intro");
  }

  return (
    <div className={ui.page}>
      <Link
        href="/dashboard/community/forum"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to forum
      </Link>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">New post</h1>
      <p className="mt-1 text-sm text-zinc-500">Share a question or topic with the community.</p>
      <div className="mt-6">
        <NewForumPostForm />
      </div>
    </div>
  );
}
