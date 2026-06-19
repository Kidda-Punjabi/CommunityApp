import { ListRow } from "@/components/ui/list-row";
import { RESOURCES_CATALOG } from "@/lib/resources/catalog";
import { ui } from "@/lib/ui/styles";

const RESOURCE_EMOJI = ["📖", "✏️", "🗺️"] as const;

export function ResourcesSection() {
  return (
    <section className="border-t border-zinc-200/80 pt-10">
      <div className="mb-4">
        <h2 className={ui.sectionTitle}>Resources</h2>
        <p className="text-sm text-zinc-500">
          Reference tools and articles — no scores, just learning.
        </p>
      </div>
      <div className={ui.stack}>
        {RESOURCES_CATALOG.map((item, index) => (
          <ListRow
            key={item.href}
            href={item.href}
            emoji={RESOURCE_EMOJI[index] ?? "📚"}
            title={item.title}
            subtitle={item.description}
          />
        ))}
      </div>
    </section>
  );
}
