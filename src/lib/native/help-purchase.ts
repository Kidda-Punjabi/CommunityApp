import { containsPurchaseLanguage } from "@/lib/native/copy";
import { isNativePurchasePath } from "@/lib/native/purchase-paths";
import type { HelpArticleRow } from "@/lib/help/articles";
import type { HelpContent } from "@/lib/help/types";

export function helpArticleIsPurchase(article: HelpArticleRow): boolean {
  if (article.category === "cancellations") return true;
  return containsPurchaseLanguage(
    [article.title, article.summary, article.bodyMarkdown].filter(Boolean).join("\n")
  );
}

export function stripPurchaseHelp(content: HelpContent): HelpContent {
  return {
    ...content,
    sections: content.sections
      .map((section) => ({
        ...section,
        articles: section.articles
          .filter(
            (article) =>
              !containsPurchaseLanguage(`${article.question}\n${article.answer}`)
          )
          .map((article) => ({
            ...article,
            links: article.links?.filter(
              (link) =>
                !isNativePurchasePath(link.href) && !containsPurchaseLanguage(link.label)
            ),
          })),
      }))
      .filter((section) => section.articles.length > 0),
  };
}
