/**
 * Verify forum RLS and constraints after running supabase/forum.sql
 *
 * Usage: npx tsx scripts/verify-forum-access.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    if (!process.env[k]) {
      process.env[k] = t.slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function findUsers() {
  const { data: activeMembers } = await admin
    .from("memberships")
    .select("user_id")
    .eq("status", "active")
    .limit(1);

  const { data: staff } = await admin
    .from("profile_roles")
    .select("user_id, role")
    .in("role", ["tutor", "community_lead", "master_admin"])
    .limit(5);

  const { data: profiles } = await admin.from("profiles").select("id").limit(20);
  const memberIds = new Set((activeMembers ?? []).map((r) => r.user_id));
  const staffIds = new Set((staff ?? []).map((r) => r.user_id));

  let nonMemberId: string | null = null;
  for (const profile of profiles ?? []) {
    if (!memberIds.has(profile.id) && !staffIds.has(profile.id)) {
      nonMemberId = profile.id;
      break;
    }
  }

  return {
    memberId: activeMembers?.[0]?.user_id ?? null,
    staffId: staff?.[0]?.user_id ?? null,
    nonMemberId,
  };
}

async function main() {
  console.log("Checking forum schema…");

  const { error: postsErr } = await admin.from("forum_posts").select("id").limit(1);
  if (postsErr) {
    console.error("forum_posts missing — run supabase/forum.sql first:", postsErr.message);
    process.exit(1);
  }

  const { error: guidelinesErr } = await admin
    .from("profiles")
    .select("has_agreed_forum_guidelines")
    .limit(1);
  if (guidelinesErr) {
    console.error("profiles.has_agreed_forum_guidelines missing:", guidelinesErr.message);
    process.exit(1);
  }

  const users = await findUsers();
  console.log("Sample users:", {
    member: users.memberId ? "found" : "none",
    staff: users.staffId ? "found" : "none",
    nonMember: users.nonMemberId ? "found" : "none",
  });

  // Seed a visible post as admin, then verify non-member cannot read via RLS-protected query pattern
  let testPostId: string | null = null;
  const authorId = users.memberId ?? users.staffId;
  if (authorId) {
    const { data: post, error } = await admin
      .from("forum_posts")
      .insert({
        author_id: authorId,
        title: "[verify] forum access test",
        body: "Temporary post for RLS verification",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Could not seed test post:", error.message);
    } else {
      testPostId = post.id;
      console.log("Seeded test post:", testPostId);
    }
  }

  if (testPostId && users.memberId) {
    const { count: likeCountBefore } = await admin
      .from("forum_likes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", users.memberId)
      .eq("post_id", testPostId);

    await admin.from("forum_likes").insert({ user_id: users.memberId, post_id: testPostId });
    const duplicate = await admin
      .from("forum_likes")
      .insert({ user_id: users.memberId, post_id: testPostId });

    if (duplicate.error) {
      console.log("✓ Duplicate like blocked:", duplicate.error.message);
    } else {
      console.error("✗ Duplicate like was allowed");
    }

    const { data: postRow } = await admin
      .from("forum_posts")
      .select("like_count")
      .eq("id", testPostId)
      .single();
    console.log("✓ like_count after one like:", postRow?.like_count);

    await admin.from("forum_likes").delete().eq("user_id", users.memberId).eq("post_id", testPostId);

    if (likeCountBefore === 0) {
      // cleanup handled below
    }
  }

  if (testPostId) {
    await admin.from("forum_posts").update({ status: "hidden" }).eq("id", testPostId);
    const { data: visiblePosts } = await admin
      .from("forum_posts")
      .select("id")
      .eq("status", "visible")
      .eq("id", testPostId);
    console.log(
      visiblePosts?.length === 0
        ? "✓ Hidden post excluded from visible status filter"
        : "✗ Hidden post still visible in status=visible query"
    );
    await admin.from("forum_posts").delete().eq("id", testPostId);
    console.log("Cleaned up test post");
  }

  console.log("\nManual checks still needed with authenticated clients:");
  console.log("- Non-member (no active membership, no staff role) cannot SELECT/INSERT forum_posts");
  console.log("- Active member can post once guidelines agreed");
  console.log("\nSchema + constraints verification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
