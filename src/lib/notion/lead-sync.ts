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
  const emailProp = props.Email;
  if (!emailProp) return null;
  if ("email" in emailProp && emailProp.email?.trim()) {
    return emailProp.email.trim();
  }
  const fromRichText = plainTextFromRichText(emailProp);
  return fromRichText || null;
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

export async function upsertNotionLeadsCache(
  supabase: SupabaseClient,
  options?: { fullSync?: boolean }
): Promise<{ upserted: number; notionPageCount: number; errors: string[] }> {
  const { count: existingCount } = await supabase
    .from("notion_leads_cache")
    .select("*", { count: "exact", head: true });

  // Empty cache must always full-crawl; incremental watermark never seeds names/emails.
  const shouldFullSync = options?.fullSync === true || (existingCount ?? 0) === 0;

  let editedAfter: string | null = null;
  if (!shouldFullSync) {
    const { data: watermarkRow } = await supabase
      .from("notion_leads_cache")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    editedAfter = (watermarkRow?.updated_at as string | null) ?? null;
  }

  const pages = await queryLeadPagesForCache(editedAfter);
  let upserted = 0;
  const errors: string[] = [];

  for (const page of pages) {
    const { error } = await supabase.from("notion_leads_cache").upsert(
      {
        notion_page_id: page.id,
        name: leadNameFromPage(page),
        email: leadEmailFromPage(page),
        phone: leadPhoneFromPage(page),
        updated_at: page.last_edited_time ?? new Date().toISOString(),
      },
      { onConflict: "notion_page_id" }
    );
    if (error) {
      errors.push(`${page.id}: ${error.message}`);
      continue;
    }
    upserted += 1;
  }

  return { upserted, notionPageCount: pages.length, errors };
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

async function queryLeadPageIdsByEmail(email: string): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return [];

  const ids = new Set<string>();
  let cursor: string | undefined;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        property: "Email",
        email: { equals: normalized },
      },
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
  await writeAppUserIdToLead(leadPageId, profileId);
  const { error } = await supabase
    .from("profiles")
    .update({ notion_lead_page_id: leadPageId })
    .eq("id", profileId)
    .is("notion_lead_page_id", null);

  if (error) throw new Error(error.message);
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

/**
 * Match profile email to Notion Leads: 0 → create, 1 → link, >1 → admin attention (non-throwing).
 */
export async function linkLeadsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  email: string,
  options?: { fullName?: string | null }
): Promise<LinkLeadsForProfileResult> {
  const result: LinkLeadsForProfileResult = {
    linked: 0,
    created: 0,
    skipped: 0,
    conflicts: 0,
    ambiguous: 0,
    leadPageId: null,
  };

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
    result.skipped = 1;
    result.leadPageId = profile.notion_lead_page_id;
    return result;
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
    result.ambiguous = 1;
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
  }
): Promise<void> {
  await supabase.from("notion_lead_link_conflicts").insert({
    profile_id: input.profileId,
    existing_notion_page_id: input.existingNotionPageId,
    attempted_notion_page_id: input.attemptedNotionPageId,
    lead_email: input.leadEmail,
    details:
      "A second Notion lead row matched this profile email but the profile is already linked to a different lead page.",
  });
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
