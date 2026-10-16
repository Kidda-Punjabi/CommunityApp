import { unblockForumUser } from "@/app/dashboard/community/forum/actions";
import { getDisplayName } from "@/lib/profile/display-name";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BlockedUsersPage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { data: blocks } = await session.supabase
    .from("forum_user_blocks")
    .select("blocked_id, created_at")
    .eq("blocker_id", session.user.id)
    .order("created_at", { ascending: false });

  const ids = (blocks ?? []).map((block) => block.blocked_id);
  const { data: profiles } = ids.length
    ? await session.supabase.from("profiles").select("id, full_name, preferred_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; preferred_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? "Member"]));

  return (
    <div className={ui.page}>
      <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600">
        ← Profile
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-zinc-900">Blocked users</h1>
      {(blocks ?? []).length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">You have not blocked anyone.</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
          {(blocks ?? []).map((block) => (
            <li key={block.blocked_id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>{nameById.get(block.blocked_id) ?? "Member"}</span>
              <form action={unblockForumUser}>
                <input type="hidden" name="blocked_id" value={block.blocked_id} />
                <button type="submit" className="font-medium text-violet-700">
                  Unblock
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
