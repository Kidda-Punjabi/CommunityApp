"use server";

import { loadForumUnread } from "@/lib/forum/unread";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";

export async function loadNavForumUnread(): Promise<number> {
  const session = await getCachedAuthSession();
  if (!session) return 0;
  try {
    return (await loadForumUnread(session.supabase, session.user.id)).fresh;
  } catch {
    return 0;
  }
}
