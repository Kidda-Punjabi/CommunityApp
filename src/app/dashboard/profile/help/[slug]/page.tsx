import { HelpArticleDetailView } from "@/components/help/help-article-detail-view";
import { loadPublishedHelpArticleBySlug } from "@/lib/help/articles";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StudentHelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const article = await loadPublishedHelpArticleBySlug(supabase, slug);
  if (!article) notFound();

  return (
    <HelpArticleDetailView
      article={article}
      backHref="/dashboard/profile/help"
    />
  );
}
