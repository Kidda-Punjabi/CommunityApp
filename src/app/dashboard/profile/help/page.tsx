import { HelpCentreView } from "@/components/help/help-centre-view";
import { loadPublishedHelpArticles } from "@/lib/help/articles";
import { getHelpBackHref, getHelpContent } from "@/lib/help";
import { helpArticleIsPurchase, stripPurchaseHelp } from "@/lib/native/help-purchase";
import { getIsNativeApp } from "@/lib/native/platform-server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function StudentHelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const nativeApp = await getIsNativeApp();
  const loadedArticles = await loadPublishedHelpArticles(supabase);
  const articles = nativeApp ? loadedArticles.filter((article) => !helpArticleIsPurchase(article)) : loadedArticles;
  const faqContent = nativeApp ? stripPurchaseHelp(getHelpContent("student")) : getHelpContent("student");

  return (
    <HelpCentreView
      articles={articles}
      faqContent={faqContent}
      backHref={getHelpBackHref("student")}
      articleBasePath="/dashboard/profile/help"
    />
  );
}
