import "server-only";

import { FALLBACK_HELP_ARTICLES } from "@/lib/help/fallback-articles";
import type { SupabaseClient } from "@supabase/supabase-js";

export type HelpArticleRow = {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string | null;
  bodyMarkdown: string;
  sortOrder: number;
};

export const HELP_CATEGORY_LABELS: Record<string, string> = {
  cancellations: "Cancellations & refunds",
  cohorts: "Cohorts",
  general: "General",
};

export function helpCategoryLabel(category: string): string {
  return HELP_CATEGORY_LABELS[category] ?? category.replace(/-/g, " ");
}

function mapHelpArticleRow(row: {
  id: string;
  slug: string;
  category: string;
  title: string;
  summary: string | null;
  body_markdown: string;
  sort_order: number;
}): HelpArticleRow {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: row.title,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
    sortOrder: Number(row.sort_order) || 0,
  };
}

function isMissingHelpArticlesTable(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    message.includes("help_articles") ||
    error.code === "42P01" ||
    error.code === "PGRST205"
  );
}

export async function loadPublishedHelpArticles(
  supabase: SupabaseClient
): Promise<HelpArticleRow[]> {
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, slug, category, title, summary, body_markdown, sort_order")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingHelpArticlesTable(error)) return FALLBACK_HELP_ARTICLES;
    throw error;
  }

  if (!data || data.length === 0) return FALLBACK_HELP_ARTICLES;

  return data.map((row) =>
    mapHelpArticleRow({
      id: row.id as string,
      slug: row.slug as string,
      category: row.category as string,
      title: row.title as string,
      summary: (row.summary as string | null) ?? null,
      body_markdown: row.body_markdown as string,
      sort_order: Number(row.sort_order) || 0,
    })
  );
}

export async function loadPublishedHelpArticleBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<HelpArticleRow | null> {
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, slug, category, title, summary, body_markdown, sort_order")
    .eq("is_published", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    if (isMissingHelpArticlesTable(error)) {
      return FALLBACK_HELP_ARTICLES.find((article) => article.slug === slug) ?? null;
    }
    throw error;
  }

  if (!data) {
    return FALLBACK_HELP_ARTICLES.find((article) => article.slug === slug) ?? null;
  }

  return mapHelpArticleRow({
    id: data.id as string,
    slug: data.slug as string,
    category: data.category as string,
    title: data.title as string,
    summary: (data.summary as string | null) ?? null,
    body_markdown: data.body_markdown as string,
    sort_order: Number(data.sort_order) || 0,
  });
}

export function groupHelpArticlesByCategory(
  articles: HelpArticleRow[]
): Array<{ category: string; label: string; articles: HelpArticleRow[] }> {
  const order: string[] = [];
  const byCategory = new Map<string, HelpArticleRow[]>();

  for (const article of articles) {
    if (!byCategory.has(article.category)) {
      byCategory.set(article.category, []);
      order.push(article.category);
    }
    byCategory.get(article.category)!.push(article);
  }

  return order.map((category) => ({
    category,
    label: helpCategoryLabel(category),
    articles: byCategory.get(category) ?? [],
  }));
}
