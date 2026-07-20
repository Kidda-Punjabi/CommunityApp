import type { SupabaseClient } from "@supabase/supabase-js";
import { notionJson } from "@/lib/notion/client";
import { parseNotionPackageRosterFromProperties } from "@/lib/notion/package-roster-sync";

type ConfirmedRosterSnapshot = {
  /** Notion lead page IDs on the package Confirmed relation (fresh pull). */
  confirmedLeadPageIds: Set<string>;
  /** App user IDs we can resolve from those confirmed leads. */
  confirmedUserIds: Set<string>;
  confirmedLeadCount: number;
  skippedNoProfile: number;
};

async function loadConfirmedRosterSnapshot(
  supabase: SupabaseClient,
  cohortId: string,
  notionPageId: string | null
): Promise<ConfirmedRosterSnapshot> {
  const confirmedUserIds = new Set<string>();
  const confirmedLeadPageIds = new Set<string>();
  let confirmedLeadCount = 0;
  let skippedNoProfile = 0;

  const { data: confirmedRows, error: rosterError } = await supabase
    .from("package_instance_notion_roster")
    .select("profile_id, notion_lead_page_id")
    .eq("cohort_id", cohortId)
    .eq("roster_status", "confirmed");

  const rosterAvailable =
    !rosterError || !rosterError.message.includes("package_instance_notion_roster");

  if (rosterAvailable && confirmedRows) {
    confirmedLeadCount = confirmedRows.length;
    for (const row of confirmedRows) {
      if (row.notion_lead_page_id) {
        confirmedLeadPageIds.add(row.notion_lead_page_id);
      }
      if (row.profile_id) {
        confirmedUserIds.add(row.profile_id);
      }
    }
  } else if (notionPageId) {
    const page = await notionJson<{ properties: Record<string, unknown> }>(
      `/pages/${notionPageId}`
    );
    const entries = parseNotionPackageRosterFromProperties(page.properties).filter(
      (entry) => entry.rosterStatus === "confirmed"
    );
    confirmedLeadCount = entries.length;
    for (const entry of entries) {
      confirmedLeadPageIds.add(entry.notionLeadPageId);
    }
  } else if (rosterError) {
    throw new Error(rosterError.message);
  }

  // Resolve profiles for confirmed leads not already on roster rows.
  for (const leadPageId of confirmedLeadPageIds) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("notion_lead_page_id", leadPageId)
      .maybeSingle();
    if (profile?.id) {
      confirmedUserIds.add(profile.id);
    } else {
      skippedNoProfile += 1;
    }
  }

  return {
    confirmedLeadPageIds,
    confirmedUserIds,
    confirmedLeadCount,
    skippedNoProfile,
  };
}

/**
 * Align cohort_members with Notion Confirmed: upsert linked confirmed students;
 * only set left_at when a member's linked lead is explicitly absent from Confirmed.
 */
export async function reconcileCohortMembersFromNotionConfirmed(
  supabase: SupabaseClient,
  cohortId: string,
  options?: { notionPageId?: string | null }
): Promise<{
  added: number;
  removed: number;
  skippedNoProfile: number;
  confirmedLeadCount: number;
}> {
  let notionPageId = options?.notionPageId ?? null;
  if (!notionPageId) {
    const { data: cohort } = await supabase
      .from("cohorts")
      .select("notion_page_id")
      .eq("id", cohortId)
      .maybeSingle();
    notionPageId = cohort?.notion_page_id ?? null;
  }

  if (!notionPageId) {
    throw new Error("Cohort has no notion_page_id; cannot reconcile from Notion Confirmed.");
  }

  const snapshot = await loadConfirmedRosterSnapshot(supabase, cohortId, notionPageId);

  const now = new Date().toISOString();

  for (const userId of snapshot.confirmedUserIds) {
    const { error } = await supabase.from("cohort_members").upsert(
      {
        cohort_id: cohortId,
        user_id: userId,
        joined_at: now,
        left_at: null,
      },
      { onConflict: "cohort_id,user_id" }
    );
    if (error) throw new Error(error.message);
  }

  const { data: activeMembers, error: membersError } = await supabase
    .from("cohort_members")
    .select("user_id")
    .eq("cohort_id", cohortId)
    .is("left_at", null);

  if (membersError) throw new Error(membersError.message);

  const activeUserIds = (activeMembers ?? []).map((row) => row.user_id);
  if (activeUserIds.length === 0) {
    return {
      added: snapshot.confirmedUserIds.size,
      removed: 0,
      skippedNoProfile: snapshot.skippedNoProfile,
      confirmedLeadCount: snapshot.confirmedLeadCount,
    };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id")
    .in("id", activeUserIds);

  if (profilesError) throw new Error(profilesError.message);

  let removed = 0;
  for (const profile of profiles ?? []) {
    if (snapshot.confirmedUserIds.has(profile.id)) continue;

    const leadPageId = profile.notion_lead_page_id?.trim();
    if (!leadPageId) {
      // No Notion lead link — cannot infer departure (staff, internal, unlinked students).
      continue;
    }

    if (snapshot.confirmedLeadPageIds.has(leadPageId)) {
      // Linked lead is still Confirmed in Notion; app row missing is a link gap, not a withdrawal.
      continue;
    }

    const { error } = await supabase
      .from("cohort_members")
      .update({ left_at: now })
      .eq("cohort_id", cohortId)
      .eq("user_id", profile.id);

    if (error) throw new Error(error.message);
    removed += 1;
  }

  return {
    added: snapshot.confirmedUserIds.size,
    removed,
    skippedNoProfile: snapshot.skippedNoProfile,
    confirmedLeadCount: snapshot.confirmedLeadCount,
  };
}
