import { AdminSiteSection } from "@/components/admin/sections/admin-site-section";
import { loadOpenForumReports } from "@/lib/forum/load-forum";
import { createClient } from "@/lib/supabase/server";

export default async function AdminSitePage() {
  const supabase = await createClient();
  const forumReports = await loadOpenForumReports(supabase);

  return <AdminSiteSection forumReports={forumReports} />;
}
