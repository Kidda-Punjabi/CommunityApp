import type { ConjugationTableConfig } from "@/lib/catchup/teaching-visuals/types";
import { ui } from "@/lib/ui/styles";

export function ConjugationTableVisual({ config }: { config: ConjugationTableConfig }) {
  const columns = config.columns?.length
    ? config.columns
    : ["Pronoun", "Masculine", "Feminine", "Auxiliary"];

  return (
    <div className={`${ui.cardBordered} overflow-hidden`}>
      {config.title ? (
        <p className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800">
          {config.title}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-violet-50/60">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-semibold text-violet-900">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.rows.map((row, index) => (
              <tr key={index} className="border-b border-zinc-100 last:border-b-0">
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-zinc-700">
                    {row[column] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
