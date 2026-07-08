import "server-only";

import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PackageRosterCandidateOption = {
  userId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  source: "profile" | "notion_lead";
  notionLeadPageId?: string;
  canAdd: boolean;
  unavailableReason?: string;
};

type NotionRosterCacheEntry = {
  leadName: string;
  leadEmail: string | null;
  profileId: string | null;
  notionLeadPageId: string;
};

function matchesQuery(value: string | null | undefined, query: string): boolean {
  return Boolean(value?.toLowerCase().includes(query));
}

async function loadEmailToUserIdMap(supabase: SupabaseClient): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);

    for (const user of data.users) {
      if (user.email) {
        map.set(user.email.trim().toLowerCase(), user.id);
      }
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return map;
}

async function loadNotionLeadCandidates(
  supabase: SupabaseClient,
  query: string,
  emailToUserId: Map<string, string>,
  profileIds: Set<string>
): Promise<PackageRosterCandidateOption[]> {
  const { data: inboxRows, error } = await supabase
    .from("notion_sync_inbox")
    .select("raw_properties");

  if (error) return [];

  const byLeadPageId = new Map<string, NotionRosterCacheEntry>();
  for (const row of inboxRows ?? []) {
    const raw = row.raw_properties as { _roster_cache?: NotionRosterCacheEntry[] } | null;
    for (const entry of raw?._roster_cache ?? []) {
      if (!entry.notionLeadPageId || !entry.leadName) continue;
      byLeadPageId.set(entry.notionLeadPageId, entry);
    }
  }

  const results: PackageRosterCandidateOption[] = [];

  for (const entry of byLeadPageId.values()) {
    if (!matchesQuery(entry.leadName, query) && !matchesQuery(entry.leadEmail, query)) {
      continue;
    }

    const email = entry.leadEmail?.trim().toLowerCase() ?? null;
    const userId =
      (entry.profileId && profileIds.has(entry.profileId) ? entry.profileId : null) ??
      (email ? emailToUserId.get(email) ?? null : null);

    results.push({
      userId,
      email: entry.leadEmail,
      displayName: entry.leadName,
      avatarUrl: null,
      source: "notion_lead",
      notionLeadPageId: entry.notionLeadPageId,
      canAdd: Boolean(userId),
      unavailableReason: userId
        ? undefined
        : "This lead does not have a Kidda app account yet. They need to sign up (or be invited) before they can be added to a package.",
    });
  }

  return results.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function searchPackageRosterCandidates(
  supabase: SupabaseClient,
  query: string
): Promise<{ results?: PackageRosterCandidateOption[]; error?: string }> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { results: [] };

  const sanitized = q.replace(/[%_]/g, "");
  if (!sanitized) return { results: [] };

  try {
    const byKey = new Map<string, PackageRosterCandidateOption>();
    const profileIds = new Set<string>();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, preferred_name, avatar_url")
      .or(`full_name.ilike.%${sanitized}%,preferred_name.ilike.%${sanitized}%`)
      .limit(25);

    if (profilesError) return { error: profilesError.message };

    for (const profile of profiles ?? []) {
      profileIds.add(profile.id);
      byKey.set(`profile:${profile.id}`, {
        userId: profile.id,
        email: null,
        displayName: getDisplayName(profile) ?? "Member",
        avatarUrl: profile.avatar_url,
        source: "profile",
        canAdd: true,
      });
    }

    const emailToUserId = await loadEmailToUserIdMap(supabase);

    const emailMatches: Array<{ email: string; userId: string }> = [];
    for (const [email, userId] of emailToUserId) {
      if (!email.includes(sanitized) || byKey.has(`profile:${userId}`)) continue;
      emailMatches.push({ email, userId });
    }

    if (emailMatches.length > 0) {
      const { data: emailProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, preferred_name, avatar_url")
        .in(
          "id",
          emailMatches.map((match) => match.userId)
        );

      const profileById = new Map((emailProfiles ?? []).map((row) => [row.id, row] as const));

      for (const match of emailMatches.slice(0, 25)) {
        const profile = profileById.get(match.userId);
        profileIds.add(match.userId);
        byKey.set(`profile:${match.userId}`, {
          userId: match.userId,
          email: match.email,
          displayName: getDisplayName(profile ?? null) ?? match.email,
          avatarUrl: profile?.avatar_url ?? null,
          source: "profile",
          canAdd: true,
        });
      }
    }

    for (const existing of byKey.values()) {
      if (existing.email) continue;
      const email = [...emailToUserId.entries()].find(([, id]) => id === existing.userId)?.[0];
      if (email) existing.email = email;
    }

    const notionLeads = await loadNotionLeadCandidates(
      supabase,
      sanitized,
      emailToUserId,
      profileIds
    );

    for (const lead of notionLeads) {
      const key = lead.userId
        ? `profile:${lead.userId}`
        : `notion:${lead.notionLeadPageId}`;
      if (byKey.has(key)) continue;
      byKey.set(key, lead);
    }

    return { results: [...byKey.values()].slice(0, 25) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Search failed." };
  }
}
