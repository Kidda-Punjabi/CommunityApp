import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import Link from "next/link";

export default async function CommunityCodePage({
  searchParams,
}: {
  searchParams: Promise<{ occurrence?: string }>;
}) {
  const { occurrence } = await searchParams;
  const admin = createServiceRoleClient();
  const { data } = occurrence
    ? await admin.from("community_session_occurrences").select("checkin_code, status").eq("id", occurrence).maybeSingle()
    : { data: null };
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)]">
      <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Check-in code</p>
      <p className="mt-4 font-heading text-7xl font-bold tracking-[0.25em] text-zinc-900">{data?.checkin_code ?? "----"}</p>
      <Link href="/admin/community/today" className="mt-8 text-sm font-semibold text-violet-700">Back</Link>
    </div>
  );
}
