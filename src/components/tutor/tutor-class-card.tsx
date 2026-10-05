import Link from "next/link";
import type { TutorClassCard } from "@/lib/tutoring/load-tutor-classes";

const issueClass = {
  red: "text-red-600",
  amber: "text-amber-700",
  green: "text-emerald-700",
} as const;

export function TutorClassCardView({ card }: { card: TutorClassCard }) {
  return (
    <Link href={card.href} className="block min-h-11 rounded-3xl bg-white p-4 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-zinc-900">{card.name}</p>
        <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
          {card.pill}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-zinc-700">
        {card.loggedCount}/{card.totalLessons}
      </p>
      {card.nextLabel ? <p className="mt-1 text-sm text-zinc-600">{card.nextLabel}</p> : null}
      <p className="mt-1 text-sm text-zinc-500">{card.schedule}</p>
      <p className={`mt-2 text-sm font-medium ${issueClass[card.issue.tone]}`}>{card.issue.label}</p>
    </Link>
  );
}
