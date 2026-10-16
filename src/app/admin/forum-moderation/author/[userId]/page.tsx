import { requireAdminFromActions } from "@/app/admin/content/actions";
import { getDisplayName } from "@/lib/profile/display-name";
import Link from "next/link";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ userId: string }> };

export default async function ForumAuthorHistoryPage({ params }: PageProps) {
  const { userId } = await params;
  const admin = await requireAdminFromActions();
  const [{ data: profile }, { data: posts }, { data: replies }] = await Promise.all([
    admin.from("profiles").select("id, full_name, preferred_name").eq("id", userId).maybeSingle(),
    admin.from("forum_posts").select("id, title, body, status, created_at").eq("author_id", userId).order("created_at", { ascending: false }),
    admin.from("forum_replies").select("id, body, status, created_at, post_id").eq("author_id", userId).order("created_at", { ascending: false }),
  ]);

  const postIds = (posts ?? []).map((post) => post.id);
  const replyIds = (replies ?? []).map((reply) => reply.id);
  const reportQueries = [];
  if (postIds.length) {
    reportQueries.push(
      admin.from("forum_reports").select("id, reason, status, created_at, post_id").in("post_id", postIds)
    );
  }
  if (replyIds.length) {
    reportQueries.push(
      admin.from("forum_reports").select("id, reason, status, created_at, reply_id").in("reply_id", replyIds)
    );
  }
  const reportSets = await Promise.all(reportQueries);
  const reports: { id: string; reason: string; status: string; created_at: string }[] = [];
  for (const result of reportSets) {
    for (const row of result.data ?? []) {
      reports.push({
        id: String(row.id),
        reason: String(row.reason),
        status: String(row.status),
        created_at: String(row.created_at),
      });
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/forum-moderation" className="text-sm text-violet-700">
        ← Forum moderation
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">
        {profile ? getDisplayName(profile) : "Author"} history
      </h1>
      <section>
        <h2 className="font-semibold text-zinc-900">Posts</h2>
        <ul className="mt-2 space-y-2 text-sm text-zinc-700">
          {(posts ?? []).map((post) => (
            <li key={post.id}>
              {post.title} · {post.status}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-zinc-900">Replies</h2>
        <ul className="mt-2 space-y-2 text-sm text-zinc-700">
          {(replies ?? []).map((reply) => (
            <li key={reply.id}>
              {reply.body.slice(0, 160)} · {reply.status}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-semibold text-zinc-900">Reports against them</h2>
        <ul className="mt-2 space-y-2 text-sm text-zinc-700">
          {reports.map((report) => (
            <li key={report.id}>
              {report.reason} · {report.status} · {new Date(report.created_at).toLocaleString("en-GB")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
