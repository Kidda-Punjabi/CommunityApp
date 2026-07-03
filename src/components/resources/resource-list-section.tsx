import { RESOURCES_CATALOG } from "@/lib/resources/catalog";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

const RESOURCE_EMOJI = ["📖", "✏️", "🗺️"] as const;

function ChevronRight() {
  return (
    <span className="text-lg leading-none text-zinc-400" aria-hidden="true">
      ›
    </span>
  );
}

export function ResourceListSection() {
  return (
    <section>
      <div className="mb-4">
        <h2 className={ui.sectionTitle}>Resources</h2>
        <p className="text-sm text-zinc-500">
          Reference tools and articles — no scores, just learning.
        </p>
      </div>
      <div className={`${ui.card} divide-y divide-zinc-100 px-4 py-1`}>
        {RESOURCES_CATALOG.map((item, index) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 py-3 transition-colors hover:text-violet-600"
          >
            <span className={ui.listRowIcon} aria-hidden="true">
              {RESOURCE_EMOJI[index] ?? "📚"}
            </span>
            <span className="min-w-0 flex-1 font-heading text-sm font-semibold text-zinc-900">
              {item.title}
            </span>
            <ChevronRight />
          </Link>
        ))}
      </div>
    </section>
  );
}
