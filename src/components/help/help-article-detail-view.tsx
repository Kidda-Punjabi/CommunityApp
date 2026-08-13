import { GotAnotherQuestion } from "@/components/help/got-another-question";
import { HelpMarkdown } from "@/components/help/help-markdown";
import { BackLink } from "@/components/navigation/back-link";
import { helpCategoryLabel, type HelpArticleRow } from "@/lib/help/articles";
import { ui } from "@/lib/ui/styles";

type HelpArticleDetailViewProps = {
  article: HelpArticleRow;
  backHref: string;
};

export function HelpArticleDetailView({ article, backHref }: HelpArticleDetailViewProps) {
  return (
    <div className={ui.page}>
      <BackLink fallbackHref={backHref} className="mb-6 inline-flex items-center gap-1">
        ← Help Centre
      </BackLink>

      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
        {helpCategoryLabel(article.category)}
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">{article.title}</h1>
      {article.summary && (
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{article.summary}</p>
      )}

      <div className="mt-8 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.06)] sm:p-6">
        <HelpMarkdown source={article.bodyMarkdown} />
      </div>

      <GotAnotherQuestion
        subject={`Question about: ${article.title}`}
      />
    </div>
  );
}
