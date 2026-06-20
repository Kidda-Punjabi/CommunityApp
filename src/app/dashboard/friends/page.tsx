import Link from "next/link";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { createClient } from "@/lib/supabase/server";
import { FriendsPageClient } from "@/components/friends/friends-page-client";
import { redirect } from "next/navigation";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await loadFriendsProfileData(supabase, user.id);

  if (data.unavailable) {
    return (
      <div className="flex flex-1 flex-col px-5 py-7">
        <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600">
          ← Profile
        </Link>
        <p className="mt-4 text-sm text-zinc-600">
          Friends are not enabled yet. Run supabase/friends-notifications.sql in Supabase.
        </p>
      </div>
    );
  }

  return <FriendsPageClient friends={data.friends} requests={data.requests} />;
}
