import Link from "next/link";
import type { QuizLevelItem } from "@/lib/progress/quiz-progress";

type QuizPathwayProps = {
  courseName: string;
  levels: QuizLevelItem[];
};

function levelClassName(status: QuizLevelItem["status"]) {
  switch (status) {
    case "completed":
      return "border-green-200 bg-green-50 text-green-800";
    case "current":
      return "border-violet-400 bg-violet-50 text-violet-800 ring-2 ring-violet-200";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-400";
  }
}

export function QuizPathway({ courseName, levels }: QuizPathwayProps) {
  if (levels.length === 0) return null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-900">{courseName}</h2>
      <p className="mt-1 text-sm text-zinc-500">Quiz pathway — complete each level to unlock the next.</p>

      <ol className="mt-4 space-y-2">
        {levels.map((level) => {
          const content = (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors ${levelClassName(level.status)}`}
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                  Level {level.level_number}
                </p>
                <p className="mt-0.5 truncate font-semibold">{level.title}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold">
                {level.status === "completed" && "✓"}
                {level.status === "current" && "→"}
                {level.status === "locked" && "🔒"}
              </span>
            </div>
          );

          if (level.status === "locked") {
            return (
              <li key={level.id} aria-disabled className="cursor-not-allowed">
                {content}
              </li>
            );
          }

          return (
            <li key={level.id}>
              <Link href={`/dashboard/practice/quiz/${level.id}`} className="block">
                {content}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
