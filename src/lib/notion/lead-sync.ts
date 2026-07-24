import {
  APP_SIGNUP_LEAD_SOURCE,
  ensureLeadSourceAppSignupOption,
  NOTION_LEADS_DATA_SOURCE_ID,
  notionJson,
  plainTextFromRichText,
  plainTextFromTitle,
} from "@/lib/notion/client";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

type NotionLeadPage = {
  id: string;
  last_edited_time?: string;
  properties: Record<string, unknown>;
};

type NotionQueryResponse = {
  results: NotionLeadPage[];
  has_more: boolean;
  next_cursor: string | null;
};

function leadNameFromPage(page: NotionLeadPage): string | null {
  const props = page.properties as Record<
    string,
    { title?: Array<{ plain_text?: string }> }
  >;
  return plainTextFromTitle(props.Name) || null;
}

function leadEmailFromPage(page: NotionLeadPage): string | null {
  const props = page.properties as Record<
    string,
    { email?: string; rich_text?: Array<{ plain_text?: string }> }
  >;
  // Prefer Email (email type); fall back to Email (Copy) rich_text — same as roster sync.
  for (const key of ["Email", "Email (Copy)"]) {
    const emailProp = props[key];
    if (!emailProp) continue;
    if ("email" in emailProp && emailProp.email?.trim()) {
      return emailProp.email.trim();
    }
    const fromRichText = plainTextFromRichText(emailProp);
    if (fromRichText) return fromRichText;
  }
  return null;
}

function leadPhoneFromPage(page: NotionLeadPage): string | null {
  const props = page.properties as Record<string, { phone_number?: string }>;
  return props.Phone?.phone_number?.trim() || null;
}

function appUserIdFromPage(page: NotionLeadPage): string | null {
  const props = page.properties as Record<
    string,
    { rich_text?: Array<{ plain_text?: string }> }
  >;
  const value = plainTextFromRichText(props["App User ID"]);
  return value || null;
}

const LEADS_CACHE_PULL_CURSOR_VIEW_TYPE = "notion_leads_cache_pull_cursor";
const LEADS_CACHE_PULL_CURSOR_NAME = "notion_leads_cache";

type LeadsCachePullCursorConfig = {
  lastEditedTime?: string;
  lastFullSyncAt?: string;
};

async function loadLeadsCachePullCursor(
  supabase: SupabaseClient
): Promise<LeadsCachePullCursorConfig | null> {
  const { data } = await supabase
    .from("admin_saved_views")
    .select("config")
    .eq("view_type", LEADS_CACHE_PULL_CURSOR_VIEW_TYPE)
    .eq("name", LEADS_CACHE_PULL_CURSOR_NAME)
    .maybeSingle();

  return (data?.config as LeadsCachePullCursorConfig | null) ?? null;
}

async function saveLeadsCachePullCursor(
  supabase: SupabaseClient,
  config: LeadsCachePullCursorConfig
): Promise<void> {
  const { data: existing } = await supabase
    .from("admin_saved_views")
    .select("id, config")
    .eq("view_type", LEADS_CACHE_PULL_CURSOR_VIEW_TYPE)
    .eq("name", LEADS_CACHE_PULL_CURSOR_NAME)
    .maybeSingle();

  const nextConfig = {
    ...((existing?.config as LeadsCachePullCursorConfig | null) ?? {}),
    ...config,
  };

  if (existing?.id) {
    await supabase.from("admin_saved_views").update({ config: nextConfig }).eq("id", existing.id);
    return;
  }

  const { data: admin } = await supabase
    .from("profiles")
    .select("id")
    .eq("app_role", "master_admin")
    .limit(1)
    .maybeSingle();

  const createdBy =
    admin?.id ??
    (await supabase.from("profiles").select("id").limit(1).maybeSingle()).data?.id;

  if (!createdBy) return;

  await supabase.from("admin_saved_views").insert({
    name: LEADS_CACHE_PULL_CURSOR_NAME,
    view_type: LEADS_CACHE_PULL_CURSOR_VIEW_TYPE,
    config: nextConfig,
    created_by: createdBy,
  });
}

async function queryLeadPagesForCache(editedAfter: string | null): Promise<NotionLeadPage[]> {
  const pages: NotionLeadPage[] = [];
  let cursor: string | null = null;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
    };
    // Incremental watermark only — omit for full cache backfills so older leads still land.
    if (editedAfter) {
      body.filter = {
        timestamp: "last_edited_time",
        last_edited_time: { after: editedAfter },
      };
    }
    if (cursor) body.start_cursor = cursor;

    const data = await notionJson<NotionQueryResponse>(
      `/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
}

/**
 * After lead contact fields change in Notion, package pages are often untouched — so
 * `_roster_cache` emails stay null until the next package pull. Patch inbox snapshots
 * from the leads cache so Packages admin / candidate search stay current.
 */
export async function patchInboxRosterCacheFromLeads(
  supabase: SupabaseClient,
  leadUpdates: Array<{ notionPageId: string; name: string | null; email: string | null }>
): Promise<number> {
  if (leadUpdates.length === 0) return 0;

  const byLeadId = new Map(
    leadUpdates.map((row) => [row.notionPageId, row] as const)
  );

  const { data: inboxRows, error } = await supabase
    .from("notion_sync_inbox")
    .select("id, raw_properties")
    .not("raw_properties", "is", null);

  if (error || !inboxRows?.length) return 0;

  let patched = 0;
  for (const row of inboxRows) {
    const raw = (row.raw_properties ?? {}) as {
      _roster_cache?: Array<{
        notionLeadPageId: string;
        leadName: string;
        leadEmail: string | null;
        rosterStatus: string;
        profileId: string | null;
        studentPackageId: string | null;
      }>;
    };
    const cache = raw._roster_cache;
    if (!cache?.length) continue;

    let changed = false;
    const nextCache = cache.map((entry) => {
      const update = byLeadId.get(entry.notionLeadPageId);
      if (!update) return entry;
      const nextName = update.name?.trim() || entry.leadName;
      const nextEmail = update.email;
      if (nextName === entry.leadName && nextEmail === entry.leadEmail) return entry;
      changed = true;
      return { ...entry, leadName: nextName, leadEmail: nextEmail };
    });

    if (!changed) continue;

    const { error: updateError } = await supabase
      .from("notion_sync_inbox")
      .update({
        raw_properties: {
          ...raw,
          _roster_cache: nextCache,
        },
      })
      .eq("id", row.id);

    if (!updateError) patched += 1;
  }

  return patched;
}

export async function upsertNotionLeadsCache(
  supabase: SupabaseClient,
  options?: { fullSync?: boolean }
): Promise<{
  upserted: number;
  notionPageCount: number;
  rosterCachesPatched: number;
  fullSync: boolean;
  errors: string[];
}> {
  const { count: existingCount } = await supabase
    .from("notion_leads_cache")
    .select("*", { count: "exact", head: true });

  const pullCursor = await loadLeadsCachePullCursor(supabase);

  // Empty cache must always full-crawl. Do not auto-full-sync on a timer here —
  // a full Leads crawl (~2k pages) can take minutes and starve the rest of notion-sync cron.
  // Use admin "Full sync" or ?fullLeadsCacheSync=1 for deliberate backfills.
  const shouldFullSync = options?.fullSync === true || (existingCount ?? 0) === 0;

  let editedAfter: string | null = null;
  if (!shouldFullSync) {
    const cursorTime = pullCursor?.lastEditedTime?.trim() || null;
    if (cursorTime) {
      // Overlap so pages edited in the same second as the saved cursor are not missed.
      editedAfter = new Date(new Date(cursorTime).getTime() - 3000).toISOString();
    } else {
      // Migrate from legacy max(updated_at) watermark once.
      const { data: watermarkRow } = await supabase
        .from("notion_leads_cache")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const legacy = (watermarkRow?.updated_at as string | null) ?? null;
      editedAfter = legacy
        ? new Date(new Date(legacy).getTime() - 3000).toISOString()
        : null;
    }
  }

  const pages = await queryLeadPagesForCache(editedAfter);
  let upserted = 0;
  const errors: string[] = [];
  let maxEdited = pullCursor?.lastEditedTime ?? null;
  const leadUpdates: Array<{
    notionPageId: string;
    name: string | null;
    email: string | null;
  }> = [];

  for (const page of pages) {
    const name = leadNameFromPage(page);
    const email = leadEmailFromPage(page);
    const phone = leadPhoneFromPage(page);
    const updatedAt = page.last_edited_time ?? new Date().toISOString();

    const { error } = await supabase.from("notion_leads_cache").upsert(
      {
        notion_page_id: page.id,
        name,
        email,
        phone,
        updated_at: updatedAt,
      },
      { onConflict: "notion_page_id" }
    );
    if (error) {
      errors.push(`${page.id}: ${error.message}`);
      continue;
    }
    upserted += 1;
    leadUpdates.push({ notionPageId: page.id, name, email });
    if (!maxEdited || updatedAt > maxEdited) {
      maxEdited = updatedAt;
    }
  }

  const rosterCachesPatched = await patchInboxRosterCacheFromLeads(supabase, leadUpdates);

  const cursorPatch: LeadsCachePullCursorConfig = {};
  if (maxEdited) cursorPatch.lastEditedTime = maxEdited;
  if (shouldFullSync) cursorPatch.lastFullSyncAt = new Date().toISOString();
  if (Object.keys(cursorPatch).length > 0) {
    await saveLeadsCachePullCursor(supabase, cursorPatch);
  }

  return {
    upserted,
    notionPageCount: pages.length,
    rosterCachesPatched,
    fullSync: shouldFullSync,
    errors,
  };
}

async function writeAppUserIdToLead(pageId: string, profileId: string): Promise<void> {
  await notionJson(`/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: {
        "App User ID": {
          rich_text: [{ text: { content: profileId } }],
        },
      },
    }),
  });
}

async function queryLeadPagesWithFilter(
  filter: Record<string, unknown>
): Promise<string[]> {
  const ids = new Set<string>();
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter,
    };
    if (cursor) body.start_cursor = cursor;

    const data = await notionJson<NotionQueryResponse>(
      `/databases/${NOTION_LEADS_DATA_SOURCE_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    for (const page of data.results) {
      ids.add(page.id);
    }

    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return [...ids];
}

async function queryLeadPageIdsByEmail(email: string): Promise<string[]> {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();
  if (!normalized) return [];

  // Email is Notion email-type; Email (Copy) is rich_text (historical imports).
  // Query both casings on Email in case stored value isn't lowercased.
  const variants = [...new Set([normalized, trimmed])];
  const orFilters: Record<string, unknown>[] = [];
  for (const value of variants) {
    orFilters.push({ property: "Email", email: { equals: value } });
    orFilters.push({ property: "Email (Copy)", rich_text: { equals: value } });
  }

  return queryLeadPagesWithFilter({ or: orFilters });
}

async function queryLeadPageIdsByAppUserId(profileId: string): Promise<string[]> {
  const id = profileId.trim();
  if (!id) return [];
  return queryLeadPagesWithFilter({
    property: "App User ID",
    rich_text: { equals: id },
  });
}

async function createAppSignupLeadPage(
  profileId: string,
  fullName: string,
  email: string
): Promise<string> {
  await ensureLeadSourceAppSignupOption();

  const displayName = fullName.trim() || email.trim();
  const data = await notionJson<{ id: string }>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: NOTION_LEADS_DATA_SOURCE_ID },
      properties: {
        Name: {
          title: [{ text: { content: displayName.slice(0, 200) } }],
        },
        Email: { email: email.trim() },
        Source: {
          rich_text: [{ text: { content: APP_SIGNUP_LEAD_SOURCE } }],
        },
        "Lead Source": {
          select: { name: APP_SIGNUP_LEAD_SOURCE },
        },
        "App User ID": {
          rich_text: [{ text: { content: profileId } }],
        },
      },
    }),
  });

  return data.id;
}

async function linkProfileToNotionLead(
  supabase: SupabaseClient,
  profileId: string,
  leadPageId: string
): Promise<void> {
  // Always write both directions in one step. Notion first (source of truth for
  // App User ID), then profiles.notion_lead_page_id — do not leave Notion updated
  // while the profile row stays null (the historical 10-vs-6 skew).
  await writeAppUserIdToLead(leadPageId, profileId);

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", profileId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (current?.notion_lead_page_id && current.notion_lead_page_id !== leadPageId) {
    throw new Error(
      `Profile ${profileId} already linked to ${current.notion_lead_page_id}, refusing ${leadPageId}`
    );
  }

  if (current?.notion_lead_page_id === leadPageId) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ notion_lead_page_id: leadPageId })
    .eq("id", profileId)
    .is("notion_lead_page_id", null);

  if (error) throw new Error(error.message);

  // Confirm the write landed (null-only update can match 0 rows under race).
  const { data: after } = await supabase
    .from("profiles")
    .select("notion_lead_page_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!after?.notion_lead_page_id) {
    const { error: forceError } = await supabase
      .from("profiles")
      .update({ notion_lead_page_id: leadPageId })
      .eq("id", profileId);
    if (forceError) throw new Error(forceError.message);
  } else if (after.notion_lead_page_id !== leadPageId) {
    throw new Error(
      `Profile ${profileId} linked to ${after.notion_lead_page_id} during race with ${leadPageId}`
    );
  }
}

async function recordAmbiguousLeadMatch(
  supabase: SupabaseClient,
  input: { profileId: string; email: string; leadPageIds: string[] }
): Promise<void> {
  console.error(
    "[notion lead link] ambiguous_lead_match",
    JSON.stringify({
      profileId: input.profileId,
      email: input.email,
      leadPageIds: input.leadPageIds,
    })
  );

  const { data: existing } = await supabase
    .from("notion_lead_link_attention")
    .select("id")
    .eq("profile_id", input.profileId)
    .is("resolved_at", null)
    .maybeSingle();

  const payload = {
    profile_id: input.profileId,
    email: input.email,
    lead_page_ids: input.leadPageIds,
    details: { reason: "ambiguous_email_match" },
    resolved_at: null,
  };

  if (existing?.id) {
    await supabase.from("notion_lead_link_attention").update(payload).eq("id", existing.id);
    return;
  }

  const { error } = await supabase.from("notion_lead_link_attention").insert(payload);
  if (error && !error.message.includes("notion_lead_link_attention")) {
    console.error("[notion lead link] Failed to insert admin attention:", error.message);
  }
}

export type LinkLeadsForProfileResult = {
  linked: number;
  created: number;
  skipped: number;
  conflicts: number;
  ambiguous: number;
  /** Notion lead page id when linked, created, or already on the profile. */
  leadPageId: string | null;
};

export type LinkLeadsForProfileOptions = {
  fullName?: string | null;
  /**
   * When true (default, signup path): create a Notion lead if email match finds none.
   * When false (historical backfill): never create — log no-match / ambiguous instead.
   */
  createIfMissing?: boolean;
};

/**
 * Match profile ↔ Notion Leads (bidirectional):
 * 1) If profile already has notion_lead_page_id → ensure Notion App User ID is set.
 * 2) Else if Notion already has App User ID = this profile → set profiles.notion_lead_page_id.
 * 3) Else email-match Email + Email (Copy): 0 → create (signup) or skip (backfill),
 *    1 → link both sides, >1 → attention + conflicts (non-throwing).
 */
export async function linkLeadsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  email: string,
  options?: LinkLeadsForProfileOptions
): Promise<LinkLeadsForProfileResult> {
  const result: LinkLeadsForProfileResult = {
    linked: 0,
    created: 0,
    skipped: 0,
    conflicts: 0,
    ambiguous: 0,
    leadPageId: null,
  };
  const createIfMissing = options?.createIfMissing !== false;

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    result.skipped = 1;
    return result;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, notion_lead_page_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    result.skipped = 1;
    return result;
  }

  if (profile.notion_lead_page_id) {
    // Heal Notion side if App User ID was never written (or drifted).
    try {
      await writeAppUserIdToLead(profile.notion_lead_page_id, profileId);
    } catch (error) {
      console.error(
        `[notion lead link] ensure App User ID failed profile=${profileId} lead=${profile.notion_lead_page_id}:`,
        error instanceof Error ? error.message : error
      );
    }
    result.skipped = 1;
    result.leadPageId = profile.notion_lead_page_id;
    return result;
  }

  // Reverse: Notion already has App User ID but profile.notion_lead_page_id is null.
  try {
    const byAppUser = await queryLeadPageIdsByAppUserId(profileId);
    if (byAppUser.length > 1) {
      await recordAmbiguousLeadMatch(supabase, {
        profileId,
        email: normalizedEmail,
        leadPageIds: byAppUser,
      });
      await logLeadLinkConflict(supabase, {
        profileId,
        existingNotionPageId: byAppUser[0]!,
        attemptedNotionPageId: byAppUser[1]!,
        leadEmail: normalizedEmail,
        details:
          "Multiple Notion leads already have this profile's App User ID; refusing to guess which to link on profiles.",
      });
      result.ambiguous = 1;
      result.conflicts = 1;
      return result;
    }
    if (byAppUser.length === 1) {
      await linkProfileToNotionLead(supabase, profileId, byAppUser[0]!);
      result.linked = 1;
      result.leadPageId = byAppUser[0]!;
      return result;
    }
  } catch (error) {
    console.error(
      `[notion lead link] reverse App User ID lookup failed profile=${profileId}:`,
      error instanceof Error ? error.message : error
    );
  }

  const displayName =
    options?.fullName?.trim() ||
    getDisplayName(profile) ||
    profile.full_name?.trim() ||
    normalizedEmail;

  let leadPageIds: string[] = [];
  try {
    leadPageIds = await queryLeadPageIdsByEmail(normalizedEmail);
  } catch (error) {
    console.error(
      `[notion lead link] queryLeadPageIdsByEmail failed profile=${profileId}:`,
      error instanceof Error ? error.message : error
    );
    result.skipped = 1;
    return result;
  }

  if (leadPageIds.length > 1) {
    await recordAmbiguousLeadMatch(supabase, {
      profileId,
      email: normalizedEmail,
      leadPageIds,
    });
    await logLeadLinkConflict(supabase, {
      profileId,
      existingNotionPageId: leadPageIds[0]!,
      attemptedNotionPageId: leadPageIds[1]!,
      leadEmail: normalizedEmail,
      details: `Ambiguous email match: ${leadPageIds.length} Notion leads share this email; not auto-linked.`,
    });
    result.ambiguous = 1;
    result.conflicts = 1;
    return result;
  }

  if (leadPageIds.length === 1) {
    const leadPageId = leadPageIds[0]!;
    try {
      const page = await notionJson<NotionLeadPage>(`/pages/${leadPageId}`);
      const existingAppUser = appUserIdFromPage(page);
      if (existingAppUser && existingAppUser !== profileId) {
        await logLeadLinkConflict(supabase, {
          profileId,
          existingNotionPageId: leadPageId,
          attemptedNotionPageId: leadPageId,
          leadEmail: normalizedEmail,
        });
        result.conflicts = 1;
        return result;
      }

      await linkProfileToNotionLead(supabase, profileId, leadPageId);
      result.linked = 1;
      result.leadPageId = leadPageId;
    } catch (error) {
      console.error(
        `[notion lead link] link existing lead failed profile=${profileId} lead=${leadPageId}:`,
        error instanceof Error ? error.message : error
      );
      result.skipped = 1;
    }
    return result;
  }

  // No email match.
  if (!createIfMissing) {
    await logLeadLinkConflict(supabase, {
      profileId,
      existingNotionPageId: "__no_match__",
      attemptedNotionPageId: "__no_match__",
      leadEmail: normalizedEmail,
      details: "No Notion lead matched this profile email during backfill; not creating a lead.",
    });
    result.conflicts = 1;
    result.skipped = 1;
    return result;
  }

  try {
    const newPageId = await createAppSignupLeadPage(profileId, displayName, normalizedEmail);
    // Prefer unconditional set after create so callers (cohort write-back) can trust
    // leadPageId without racing a concurrent null-only update that matches 0 rows.
    const { error: linkError } = await supabase
      .from("profiles")
      .update({ notion_lead_page_id: newPageId })
      .eq("id", profileId)
      .is("notion_lead_page_id", null);

    if (linkError) {
      throw new Error(linkError.message);
    }

    const { data: afterCreate } = await supabase
      .from("profiles")
      .select("notion_lead_page_id")
      .eq("id", profileId)
      .maybeSingle();

    // If another request linked first, keep that id; otherwise use the page we created.
    result.leadPageId = afterCreate?.notion_lead_page_id ?? newPageId;
    if (!afterCreate?.notion_lead_page_id) {
      const { error: forceError } = await supabase
        .from("profiles")
        .update({ notion_lead_page_id: newPageId })
        .eq("id", profileId);
      if (forceError) throw new Error(forceError.message);
      result.leadPageId = newPageId;
    }
    result.created = 1;
  } catch (error) {
    console.error(
      `[notion lead link] createAppSignupLeadPage failed profile=${profileId}:`,
      error instanceof Error ? error.message : error
    );
    result.skipped = 1;
  }

  return result;
}

export async function linkUnlinkedProfilesFromApp(
  supabase: SupabaseClient
): Promise<{
  processed: number;
  linked: number;
  created: number;
  ambiguous: number;
  skipped: number;
  conflicts: number;
  errors: string[];
}> {
  const totals = {
    processed: 0,
    linked: 0,
    created: 0,
    ambiguous: 0,
    skipped: 0,
    conflicts: 0,
    errors: [] as string[],
  };

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, notion_lead_page_id")
    .is("notion_lead_page_id", null)
    .order("created_at", { ascending: false });

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profiles?.length) {
    return totals;
  }

  const emailByProfileId = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (authError) {
      totals.errors.push(authError.message);
      break;
    }

    for (const user of authData.users) {
      if (user.email) {
        emailByProfileId.set(user.id, user.email);
      }
    }

    if (authData.users.length < 200) break;
    page += 1;
  }

  for (const profile of profiles) {
    const email = emailByProfileId.get(profile.id)?.trim();
    if (!email) {
      totals.skipped += 1;
      continue;
    }

    totals.processed += 1;
    try {
      const outcome = await linkLeadsForProfile(supabase, profile.id, email, {
        fullName: getDisplayName(profile),
      });
      totals.linked += outcome.linked;
      totals.created += outcome.created;
      totals.ambiguous += outcome.ambiguous;
      totals.skipped += outcome.skipped;
      totals.conflicts += outcome.conflicts;

      try {
        const { maybeGrantAccessAfterLeadLink } = await import(
          "@/lib/notion/lead-purchase-access-grant"
        );
        await maybeGrantAccessAfterLeadLink(supabase, profile.id, outcome);
      } catch (grantError) {
        totals.errors.push(
          `${profile.id} grant: ${grantError instanceof Error ? grantError.message : "grant failed"}`
        );
      }
    } catch (error) {
      totals.errors.push(
        `${profile.id}: ${error instanceof Error ? error.message : "Lead link failed."}`
      );
    }
  }

  return totals;
}

export async function loadLeadLinkAttentionItems(
  supabase: SupabaseClient
): Promise<
  Array<{
    id: string;
    profileId: string;
    email: string | null;
    leadPageIds: string[];
    createdAt: string;
  }>
> {
  const { data, error } = await supabase
    .from("notion_lead_link_attention")
    .select("id, profile_id, email, lead_page_ids, created_at")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    if (error.message.includes("notion_lead_link_attention")) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    email: row.email,
    leadPageIds: row.lead_page_ids ?? [],
    createdAt: row.created_at,
  }));
}

async function logLeadLinkConflict(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    existingNotionPageId: string;
    attemptedNotionPageId: string;
    leadEmail: string;
    details?: string;
  }
): Promise<void> {
  await supabase.from("notion_lead_link_conflicts").insert({
    profile_id: input.profileId,
    existing_notion_page_id: input.existingNotionPageId,
    attempted_notion_page_id: input.attemptedNotionPageId,
    lead_email: input.leadEmail,
    details:
      input.details ??
      "A second Notion lead row matched this profile email but the profile is already linked to a different lead page.",
  });
}

/**
 * One-time / cron-safe match-only reconcile: never creates Notion leads.
 * Links both profiles.notion_lead_page_id and Notion App User ID on clean matches.
 */
export async function backfillProfileNotionLeadLinks(
  supabase: SupabaseClient
): Promise<{
  processed: number;
  linked: number;
  ambiguous: number;
  skipped: number;
  conflicts: number;
  noMatch: number;
  healedExisting: number;
  errors: string[];
}> {
  const totals = {
    processed: 0,
    linked: 0,
    ambiguous: 0,
    skipped: 0,
    conflicts: 0,
    noMatch: 0,
    healedExisting: 0,
    errors: [] as string[],
  };

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, preferred_name, notion_lead_page_id")
    .order("created_at", { ascending: true });

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profiles?.length) {
    return totals;
  }

  const emailByProfileId = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (authError) {
      totals.errors.push(authError.message);
      break;
    }

    for (const user of authData.users) {
      if (user.email) {
        emailByProfileId.set(user.id, user.email);
      }
    }

    if (authData.users.length < 200) break;
    page += 1;
  }

  for (const profile of profiles) {
    const email = emailByProfileId.get(profile.id)?.trim();
    if (!email) {
      totals.skipped += 1;
      continue;
    }

    totals.processed += 1;
    const hadLink = Boolean(profile.notion_lead_page_id);
    try {
      const outcome = await linkLeadsForProfile(supabase, profile.id, email, {
        fullName: getDisplayName(profile),
        createIfMissing: false,
      });
      totals.linked += outcome.linked;
      totals.ambiguous += outcome.ambiguous;
      totals.skipped += outcome.skipped;
      totals.conflicts += outcome.conflicts;
      if (hadLink && outcome.skipped) {
        totals.healedExisting += 1;
      }
      if (
        !hadLink &&
        outcome.conflicts &&
        !outcome.linked &&
        !outcome.ambiguous &&
        outcome.skipped
      ) {
        totals.noMatch += 1;
      }
    } catch (error) {
      totals.errors.push(
        `${profile.id}: ${error instanceof Error ? error.message : "Lead link failed."}`
      );
    }
  }

  return totals;
}

export async function linkLeadsFromNotion(
  supabase: SupabaseClient
): Promise<{
  linked: number;
  created: number;
  ambiguous: number;
  skipped: number;
  conflicts: number;
  errors: string[];
}> {
  // Profile-centric email lookup (via linkLeadsForProfile) — no full Leads DB scan.
  return linkUnlinkedProfilesFromApp(supabase);
}

export async function loadLeadLinkAdminSnapshot(supabase: SupabaseClient): Promise<{
  unlinkedProfiles: Array<{ id: string; label: string; email: string | null }>;
  conflicts: Array<{
    id: string;
    profileId: string;
    profileLabel: string;
    leadEmail: string | null;
    existingNotionPageId: string;
    attemptedNotionPageId: string;
    details: string | null;
    createdAt: string;
  }>;
}> {
  const [{ data: profiles }, { data: conflicts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, preferred_name, notion_lead_page_id")
      .is("notion_lead_page_id", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("notion_lead_link_conflicts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const profileIds = (profiles ?? []).map((row) => row.id);
  const emailById = new Map<string, string | null>();

  if (profileIds.length > 0) {
    const { data: authData } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    for (const user of authData?.users ?? []) {
      if (profileIds.includes(user.id)) {
        emailById.set(user.id, user.email ?? null);
      }
    }
  }

  const conflictProfileIds = [...new Set((conflicts ?? []).map((row) => row.profile_id))];
  const { data: conflictProfiles } =
    conflictProfileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", conflictProfileIds)
      : { data: [] };

  const conflictLabelById = new Map(
    (conflictProfiles ?? []).map((row) => [row.id, getDisplayName(row) ?? row.id] as const)
  );

  return {
    unlinkedProfiles: (profiles ?? []).map((row) => ({
      id: row.id,
      label: getDisplayName(row) ?? row.id.slice(0, 8),
      email: emailById.get(row.id) ?? null,
    })),
    conflicts: (conflicts ?? []).map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      profileLabel: conflictLabelById.get(row.profile_id) ?? row.profile_id.slice(0, 8),
      leadEmail: row.lead_email,
      existingNotionPageId: row.existing_notion_page_id,
      attemptedNotionPageId: row.attempted_notion_page_id,
      details: row.details,
      createdAt: row.created_at,
    })),
  };
}
