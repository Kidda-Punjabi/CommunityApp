import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import type { ComparisonRow, DialectContent, VocabRow } from "@/lib/resources/dialects/content";
import { DIALECTS_HUB_HREF } from "@/lib/resources/dialects/content";

function VocabularyTable({
  rows,
  dialectName,
}: {
  rows: VocabRow[];
  dialectName: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700">English</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700">Majhi</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700">{dialectName}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((row) => (
            <tr key={row.english}>
              <td className="px-4 py-3 text-zinc-700">{row.english}</td>
              <td className="px-4 py-3 text-zinc-900">{row.majhi}</td>
              <td className="px-4 py-3 text-zinc-900">{row.dialect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonTable({ rows, dialectName }: { rows: ComparisonRow[]; dialectName: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700">&nbsp;</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700">Majhi (standard)</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-700">{dialectName}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-3 font-medium text-zinc-700">{row.label}</td>
              <td className="px-4 py-3 text-zinc-900">{row.majhi}</td>
              <td className="px-4 py-3 text-zinc-900">{row.dialect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DialectArticle({ dialect }: { dialect: DialectContent }) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <BackLink fallbackHref={DIALECTS_HUB_HREF} className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Back
        </BackLink>
        {dialect.isAnchor ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              The dialect you&apos;re already learning
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{dialect.name}</h1>
          </>
        ) : (
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">{dialect.name}</h1>
        )}
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Where it&apos;s spoken
        </h2>
        <p className="text-base leading-relaxed text-zinc-700">{dialect.whereSpoken}</p>
      </section>

      {dialect.framingNote && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm leading-relaxed text-amber-900">{dialect.framingNote}</p>
        </section>
      )}

      {dialect.whyKiddaTeaches && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Why Kidda teaches this dialect
          </h2>
          {dialect.whyKiddaTeaches.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-zinc-700">
              {paragraph}
            </p>
          ))}
        </section>
      )}

      {dialect.whyMatters && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Why this matters
          </h2>
          <p className="text-base leading-relaxed text-zinc-700">{dialect.whyMatters}</p>
        </section>
      )}

      {dialect.sentenceStructure && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Sentence structure
          </h2>
          {dialect.sentenceStructure.prose?.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-base leading-relaxed text-zinc-700">
              {paragraph}
            </p>
          ))}
          {dialect.sentenceStructure.comparisonTable && (
            <ComparisonTable
              rows={dialect.sentenceStructure.comparisonTable}
              dialectName={dialect.name}
            />
          )}
        </section>
      )}

      {dialect.phoneticSubstitutions && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Phonetic substitutions
          </h2>
          <p className="text-base leading-relaxed text-zinc-700">{dialect.phoneticSubstitutions}</p>
        </section>
      )}

      {dialect.vocabulary && dialect.vocabulary.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Vocabulary
          </h2>
          <VocabularyTable rows={dialect.vocabulary} dialectName={dialect.name} />
        </section>
      )}

      {dialect.tone && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Tone</h2>
          <p className="text-base leading-relaxed text-zinc-700">{dialect.tone}</p>
        </section>
      )}
    </article>
  );
}
