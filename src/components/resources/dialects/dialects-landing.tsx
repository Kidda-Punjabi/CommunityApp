import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { DialectMap } from "@/components/resources/dialects/dialect-map";
import {
  DIALECTS,
  DIALECTS_HUB_HREF,
  DIALECTS_INTRO,
} from "@/lib/resources/dialects/content";

export function DialectsLanding() {
  const majhi = DIALECTS.find((dialect) => dialect.isAnchor)!;
  const otherDialects = DIALECTS.filter((dialect) => !dialect.isAnchor);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <BackLink className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back</BackLink>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Punjabi dialects</h1>
        <div className="space-y-2 text-base leading-relaxed text-zinc-600">
          {DIALECTS_INTRO.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Dialect regions
        </h2>
        <DialectMap />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Start here
        </h2>
        <Link
          href={`${DIALECTS_HUB_HREF}/${majhi.slug}`}
          className="block rounded-xl border border-violet-200 bg-violet-50/80 p-4 transition-colors hover:border-violet-300 hover:bg-violet-50"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            The dialect you&apos;re already learning
          </p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">{majhi.name}</p>
          <p className="mt-1 text-sm text-zinc-600">{majhi.cardDescription}</p>
          <p className="mt-3 text-sm font-medium text-violet-600">Read more →</p>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Other dialects
        </h2>
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
          {otherDialects.map((dialect) => (
            <li key={dialect.slug}>
              <Link
                href={`${DIALECTS_HUB_HREF}/${dialect.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{dialect.name}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{dialect.cardDescription}</p>
                </div>
                <span className="shrink-0 text-sm text-zinc-400" aria-hidden="true">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
