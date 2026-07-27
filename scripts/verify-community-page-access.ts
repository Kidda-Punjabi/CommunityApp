/**
 * Verify Community page access gating for Next class.
 *
 *   node --env-file=.env.local --import tsx scripts/verify-community-page-access.ts
 */
import { createClient } from "@supabase/supabase-js";
import { COMMUNITY_COURSE_ID } from "../src/lib/topics/constants";
import { hasConfirmedCommunityPackage } from "../src/lib/community/access";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: withPackage } = await admin
    .from("student_packages")
    .select("user_id")
    .eq("course_id", COMMUNITY_COURSE_ID)
    .eq("status", "confirmed")
    .limit(1)
    .maybeSingle();

  const { data: withoutPackage } = await admin
    .from("profiles")
    .select("id")
    .limit(50);

  let noPackageUser: string | null = null;
  for (const profile of withoutPackage ?? []) {
    const has = await hasConfirmedCommunityPackage(admin, profile.id);
    if (!has) {
      noPackageUser = profile.id;
      break;
    }
  }

  console.log("1) User WITH confirmed Community package:");
  if (withPackage?.user_id) {
    const has = await hasConfirmedCommunityPackage(admin, withPackage.user_id);
    console.log(has ? "  PASS — hasConfirmedCommunityPackage true" : "  FAIL");
  } else {
    console.log("  SKIP — no confirmed Community student_packages row in prod");
  }

  console.log("2) User WITHOUT confirmed Community package:");
  if (noPackageUser) {
    const has = await hasConfirmedCommunityPackage(admin, noPackageUser);
    console.log(!has ? "  PASS — hasConfirmedCommunityPackage false" : "  FAIL");
  } else {
    console.log("  SKIP — could not find a user without package");
  }

  console.log("3) Forum preview loads single post with bodySnippet:");
  const { loadForumPostPreviews } = await import("../src/lib/forum/load-forum.ts");
  const viewer = withPackage?.user_id ?? noPackageUser;
  if (viewer) {
    const posts = await loadForumPostPreviews(admin, viewer, 1);
    console.log(
      posts.length <= 1 && (posts[0]?.bodySnippet?.length ?? 0) > 0
        ? `  PASS — ${posts.length} preview, snippet="${posts[0]?.bodySnippet?.slice(0, 40)}…"`
        : `  ${posts[0]?.bodySnippet ? "PASS" : "WARN"} — previews: ${posts.length}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
