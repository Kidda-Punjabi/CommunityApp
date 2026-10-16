import { addBlockedTerm, removeBlockedTerm } from "@/app/admin/forum-moderation/actions";
import { requireAdminFromActions } from "@/app/admin/content/actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BlockedWordsPage() {
  const admin = await requireAdminFromActions();
  const { data: terms } = await admin
    .from("forum_blocked_terms")
    .select("id, term, created_at")
    .order("term", { ascending: true });

  return (
    <div className="space-y-4">
      <Link href="/admin/forum-moderation" className="text-sm text-violet-700">
        ← Forum moderation
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900">Blocked words</h1>
      <form action={addBlockedTerm} className="flex gap-2">
        <input
          name="term"
          required
          placeholder="Add a word"
          className="rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white">
          Add
        </button>
      </form>
      <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
        {(terms ?? []).map((term) => (
          <li key={term.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <span>{term.term}</span>
            <form action={removeBlockedTerm}>
              <input type="hidden" name="term_id" value={term.id} />
              <button type="submit" className="text-red-700">
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
