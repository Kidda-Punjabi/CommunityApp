import "server-only";

import { APP_REVIEW_USER_ID } from "@/lib/community/constants";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UnplacedMember = {
  userId: string;
  name: string;
  timezone: string;
  email: string | null;
  phone: string | null;
  level: number | null;
  sessionTitle: string | null;
  podName: string | null;
  joinedAt: string;
  days: number;
};

export async function loadUnplacedMembers(admin: SupabaseClient): Promise<UnplacedMember[]> {
  const { data: packages, error } = await admin
    .from("student_packages")
    .select("user_id, created_at")
    .eq("course_id", COMMUNITY_COURSE_ID)
    .eq("status", "confirmed");
  if (error) throw error;

  const joined = new Map<string, string>();
  for (const row of packages ?? []) {
    if (row.user_id === APP_REVIEW_USER_ID) continue;
    const current = joined.get(row.user_id);
    if (!current || row.created_at < current) joined.set(row.user_id, row.created_at);
  }
  const ids = [...joined.keys()];
  if (ids.length === 0) return [];

  const [{ data: profiles }, { data: metas }, { data: sessions }, { data: pods }] = await Promise.all([
    admin.from("profiles").select("id, full_name, timezone, kidda_level").in("id", ids),
    admin.from("community_memberships_meta").select("user_id, main_session_id, pod_id").in("user_id", ids),
    admin.from("community_sessions").select("id, title"),
    admin.from("pods").select("id, name"),
  ]);
  const sessionTitle = new Map((sessions ?? []).map((session) => [session.id, session.title as string]));
  const podName = new Map((pods ?? []).map((pod) => [pod.id, pod.name as string]));
  const metaByUser = new Map((metas ?? []).map((meta) => [meta.user_id as string, meta]));

  const { data: contacts } = await admin.rpc("community_member_contacts", { p_ids: ids });
  const contactById = new Map(
    ((contacts ?? []) as { id: string; email: string | null; phone: string | null }[]).map((contact) => [contact.id, contact])
  );

  const rows: UnplacedMember[] = [];
  for (const profile of profiles ?? []) {
    const meta = metaByUser.get(profile.id);
    const missing = !meta?.main_session_id || profile.kidda_level == null || !meta?.pod_id;
    if (!missing) continue;
    const joinedAt = joined.get(profile.id) ?? new Date().toISOString();
    const days = Math.floor((Date.now() - Date.parse(joinedAt)) / 86_400_000);
    rows.push({
      userId: profile.id,
      name: profile.full_name || "Member",
      timezone: profile.timezone || "Europe/London",
      email: contactById.get(profile.id)?.email ?? null,
      phone: contactById.get(profile.id)?.phone ?? null,
      level: profile.kidda_level,
      sessionTitle: meta?.main_session_id ? sessionTitle.get(meta.main_session_id) ?? null : null,
      podName: meta?.pod_id ? podName.get(meta.pod_id) ?? null : null,
      joinedAt,
      days,
    });
  }
  return rows.sort((a, b) => b.days - a.days);
}
