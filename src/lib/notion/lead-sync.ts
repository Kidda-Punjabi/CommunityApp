import {
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

async function queryUnlinkedLeadPages(): Promise<NotionLeadPage[]> {
  const pages: NotionLeadPage[] = [];
  let cursor: string | null = null;

  do {
    const body: Record<string, unknown> = {
      page_size: 100,
      filter: {
        property: "App User ID",
        rich_text: { is_empty: true },
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
      if (leadEmailFromPage(page)) pages.push(page);
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
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

async function buildEmailToProfileMap(
  supabase: SupabaseClient
): Promise<Map<string, { id: string; notionLeadPageId: string | null }>> {
  const map = new Map<string, { id: string; notionLeadPageId: string | null }>();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id");

  if (error) throw new Error(error.message);

  const profileIds = (profiles ?? []).map((row) => row.id);
  if (profileIds.length === 0) return map;

  let page = 1;
  while (true) {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (authError) throw new Error(authError.message);

    for (const user of authData.users) {
      if (!user.email || !profileIds.includes(user.id)) continue;
      const profile = profiles?.find((row) => row.id === user.id);
      map.set(user.email.trim().toLowerCase(), {
        id: user.id,
        notionLeadPageId: profile?.notion_lead_page_id ?? null,
      });
    }

    if (authData.users.length < 200) break;
    page += 1;
  }

  return map;
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

export async function linkLeadsForProfile(
  supabase: SupabaseClient,
  profileId: string,
  email: string
): Promise<{ linked: number; skipped: number; conflicts: number }> {
  const pages = await queryUnlinkedLeadPages();
  const normalizedEmail = email.trim().toLowerCase();
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, notion_lead_page_id")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) return { linked, skipped, conflicts: 0 };

  for (const page of pages) {
    const leadEmail = leadEmailFromPage(page);
    if (!leadEmail || leadEmail.trim().toLowerCase() !== normalizedEmail) {
      continue;
    }

    if (appUserIdFromPage(page)) {
      skipped += 1;
      continue;
    }

    if (profile.notion_lead_page_id && profile.notion_lead_page_id !== page.id) {
      await logLeadLinkConflict(supabase, {
        profileId: profile.id,
        existingNotionPageId: profile.notion_lead_page_id,
        attemptedNotionPageId: page.id,
        leadEmail,
      });
      conflicts += 1;
      continue;
    }

    await writeAppUserIdToLead(page.id, profile.id);
    await supabase
      .from("profiles")
      .update({ notion_lead_page_id: page.id })
      .eq("id", profile.id)
      .is("notion_lead_page_id", null);

    linked += 1;
    break;
  }

  return { linked, skipped, conflicts };
}

export async function linkLeadsFromNotion(
  supabase: SupabaseClient
): Promise<{
  linked: number;
  skipped: number;
  conflicts: number;
  errors: string[];
}> {
  const pages = await queryUnlinkedLeadPages();
  const emailToProfile = await buildEmailToProfileMap(supabase);
  let linked = 0;
  let skipped = 0;
  let conflicts = 0;
  const errors: string[] = [];

  for (const page of pages) {
    const leadEmail = leadEmailFromPage(page);
    if (!leadEmail) {
      skipped += 1;
      continue;
    }

    const profile = emailToProfile.get(leadEmail.trim().toLowerCase());
    if (!profile) {
      skipped += 1;
      continue;
    }

    if (appUserIdFromPage(page)) {
      skipped += 1;
      continue;
    }

    if (profile.notionLeadPageId && profile.notionLeadPageId !== page.id) {
      await logLeadLinkConflict(supabase, {
        profileId: profile.id,
        existingNotionPageId: profile.notionLeadPageId,
        attemptedNotionPageId: page.id,
        leadEmail,
      });
      conflicts += 1;
      continue;
    }

    try {
      await writeAppUserIdToLead(page.id, profile.id);
      const { error } = await supabase
        .from("profiles")
        .update({ notion_lead_page_id: page.id })
        .eq("id", profile.id)
        .is("notion_lead_page_id", null);

      if (error) {
        errors.push(`${page.id}: ${error.message}`);
        continue;
      }

      profile.notionLeadPageId = page.id;
      linked += 1;
    } catch (error) {
      errors.push(
        `${page.id}: ${error instanceof Error ? error.message : "Lead link failed."}`
      );
    }
  }

  return { linked, skipped, conflicts, errors };
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
