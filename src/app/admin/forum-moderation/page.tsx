import { ForumModerationActions } from "@/components/admin/forum-moderation-actions";
import { requireAdminFromActions } from "@/app/admin/content/actions";
import { getDisplayName } from "@/lib/profile/display-name";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Group = {
  key: string;
  targetType: "post" | "reply";
  targetId: string;
  preview: string;
  authorId: string;
  authorName: string;
  reasons: string[];
  count: number;
  oldest: string;
};

export default async function AdminForumModerationPage() {
  const admin = await requireAdminFromActions();
  const { data: reports } = await admin
    .from("forum_reports")
    .select("id, reason, created_at, post_id, reply_id")
    .eq("status", "open")
    .order("created_at", { ascending: true });

  const rows = reports ?? [];
  const postIds = [...new Set(rows.map((row) => row.post_id).filter(Boolean))] as string[];
  const replyIds = [...new Set(rows.map((row) => row.reply_id).filter(Boolean))] as string[];
  const [{ data: posts }, { data: replies }] = await Promise.all([
    postIds.length
      ? admin.from("forum_posts").select("id, title, body, author_id").in("id", postIds)
      : Promise.resolve({ data: [] as { id: string; title: string; body: string; author_id: string }[] }),
    replyIds.length
      ? admin.from("forum_replies").select("id, body, author_id").in("id", replyIds)
      : Promise.resolve({ data: [] as { id: string; body: string; author_id: string }[] }),
  ]);
  const authorIds = [
    ...new Set([
      ...(posts ?? []).map((post) => post.author_id),
      ...(replies ?? []).map((reply) => reply.author_id),
    ]),
  ];
  const { data: profiles } = authorIds.length
    ? await admin.from("profiles").select("id, full_name, preferred_name").in("id", authorIds)
    : { data: [] as { id: string; full_name: string | null; preferred_name: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, getDisplayName(profile)])
  );

  const groups = new Map<string, Group>();
  for (const report of rows) {
    const targetType = report.post_id ? "post" : "reply";
    const targetId = (report.post_id ?? report.reply_id) as string;
    const key = `${targetType}:${targetId}`;
    const post = (posts ?? []).find((item) => item.id === report.post_id);
    const reply = (replies ?? []).find((item) => item.id === report.reply_id);
    const authorId = post?.author_id ?? reply?.author_id ?? "";
    const preview = post ? `${post.title}: ${post.body}` : reply?.body ?? "Content unavailable";
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.reasons.includes(report.reason)) existing.reasons.push(report.reason);
      continue;
    }
    groups.set(key, {
      key,
      targetType,
      targetId,
      preview: preview.slice(0, 180),
      authorId,
      authorName: nameById.get(authorId) ?? "Member",
      reasons: [report.reason],
      count: 1,
      oldest: report.created_at,
    });
  }

  const items = [...groups.values()].sort((a, b) => a.oldest.localeCompare(b.oldest));
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900">Forum moderation</h1>
        <Link href="/admin/forum-moderation/words" className="text-sm font-medium text-violet-700">
          Blocked words
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">No open reports.</p>
      ) : (
        items.map((item) => {
          const stale = new Date(item.oldest).getTime() <= dayAgo;
          return (
            <article
              key={item.key}
              className={`rounded-2xl border p-4 ${stale ? "border-red-300 bg-red-50" : "border-zinc-200 bg-white"}`}
            >
              <p className="text-sm text-zinc-900">{item.preview}</p>
              <p className="mt-2 text-xs text-zinc-600">
                {item.authorName} · {item.count} report{item.count === 1 ? "" : "s"} · {item.reasons.join(", ")} ·{" "}
                {new Date(item.oldest).toLocaleString("en-GB")}
              </p>
              <ForumModerationActions
                targetType={item.targetType}
                targetId={item.targetId}
                authorId={item.authorId}
              />
            </article>
          );
        })
      )}
    </div>
  );
}
