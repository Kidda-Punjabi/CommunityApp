import { HelpCentreView } from "@/components/help/help-centre-view";
import { loadPublishedHelpArticles } from "@/lib/help/articles";
import { getHelpBackHref, getHelpContent } from "@/lib/help";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StudentHelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const articles = await loadPublishedHelpArticles(supabase);
  const faqContent = getHelpContent("student");

  return (
    <HelpCentreView
      articles={articles}
      faqContent={faqContent}
      backHref={getHelpBackHref("student")}
      articleBasePath="/dashboard/profile/help"
    />
  );
}
