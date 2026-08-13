import { GotAnotherQuestion } from "@/components/help/got-another-question";
import { BackLink } from "@/components/navigation/back-link";
import {
  groupHelpArticlesByCategory,
  type HelpArticleRow,
} from "@/lib/help/articles";
import type { HelpContent } from "@/lib/help/types";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { HelpFaqAccordion } from "@/components/help/help-faq-accordion";

type HelpCentreViewProps = {
  articles: HelpArticleRow[];
  faqContent?: HelpContent | null;
  backHref: string;
  articleBasePath: string;
};

export function HelpCentreView({
  articles,
  faqContent,
  backHref,
  articleBasePath,
}: HelpCentreViewProps) {
  const groups = groupHelpArticlesByCategory(articles);

  return (
    <div className={ui.page}>
      <BackLink fallbackHref={backHref} className="mb-6 inline-flex items-center gap-1">
        ← Back
      </BackLink>

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Help Centre</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Policies and answers for payments, cancellations, cohorts, and using Kidda.
        </p>
      </div>

      {groups.length === 0 ? (
        <div className={ui.cardBordered}>
          <p className="text-sm text-zinc-600">
            Help articles are being set up. In the meantime, email{" "}
            <a
              href="mailto:hello@kidda.app"
              className="font-semibold text-violet-600 hover:text-violet-500"
            >
              hello@kidda.app
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category}>
              <h2 className="text-lg font-semibold text-zinc-900">{group.label}</h2>
              <div className="mt-3 divide-y divide-zinc-100 overflow-hidden rounded-3xl border border-zinc-200/80 bg-white">
                {group.articles.map((article) => (
                  <Link
                    key={article.id}
                    href={`${articleBasePath}/${article.slug}`}
                    className="block px-5 py-4 transition-colors hover:bg-zinc-50"
                  >
                    <p className="font-medium text-zinc-900">{article.title}</p>
                    {article.summary && (
                      <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                        {article.summary}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-semibold text-violet-600">Read article →</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {faqContent && faqContent.sections.length > 0 && (
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-900">Using the app</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Short guides for lessons, homework, games, and your account.
          </p>
          <div className="mt-4">
            <HelpFaqAccordion content={faqContent} />
          </div>
        </div>
      )}

      <GotAnotherQuestion />
    </div>
  );
}
