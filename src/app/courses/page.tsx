import { BackLink } from "@/components/navigation/back-link";
import { BookCallCard } from "@/components/booking/book-call-card";
import { getProductContent } from "@/lib/products/content";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PRODUCTS = [
  {
    slug: "foundational" as const,
    tagline: "Pronunciation in 4 hours",
    price: "From £70",
  },
  {
    slug: "beginners" as const,
    tagline: "Group from £400 · 1-to-1 from £480",
    price: "12-week live course",
  },
  {
    slug: "community" as const,
    tagline: "Ongoing live speaking practice",
    price: "£99/yr",
  },
];

export default async function CoursesIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const backHref = user ? "/dashboard/home" : "/";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 via-white to-zinc-50">
      <main className={`mx-auto max-w-2xl ${ui.page}`}>
        <BackLink fallbackHref={backHref} className="text-sm font-medium text-violet-600">← Back</BackLink>
        <h1 className="mt-4 font-heading text-3xl font-bold text-zinc-900">Kidda Courses</h1>
        <p className="mt-2 text-zinc-600">
          Choose the path that fits your Punjabi learning goals.
        </p>

        <div className={`mt-8 ${ui.stackLoose}`}>
          <BookCallCard variant="compact" />

          {PRODUCTS.map((product) => {
            const content = getProductContent(product.slug);
            return (
              <Link
                key={product.slug}
                href={`/courses/${product.slug}`}
                className={ui.cardInteractive}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                  {product.price}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900">{content.heroTitle}</h2>
                <p className="mt-1 text-sm text-zinc-600">{product.tagline}</p>
                <p className="mt-3 text-sm font-medium text-violet-600">Learn more →</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
