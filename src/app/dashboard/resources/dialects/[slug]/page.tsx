import { notFound } from "next/navigation";
import { DialectArticle } from "@/components/resources/dialects/dialect-article";
import { DIALECT_BY_SLUG } from "@/lib/resources/dialects/content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(DIALECT_BY_SLUG).map((slug) => ({ slug }));
}

export default async function DialectDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const dialect = DIALECT_BY_SLUG[slug];

  if (!dialect) notFound();

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <DialectArticle dialect={dialect} />
    </div>
  );
}
