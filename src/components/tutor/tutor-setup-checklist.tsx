import Link from "next/link";
import type { TutorSetupStatus } from "@/lib/tutoring/tutor-setup-status";
import { cn, ui } from "@/lib/ui/styles";

type TutorSetupChecklistProps = {
  status: TutorSetupStatus;
  /** Larger heading for the dedicated setup page */
  variant?: "card" | "page";
};

export function TutorSetupChecklist({ status, variant = "card" }: TutorSetupChecklistProps) {
  const { items, completedCount, totalCount } = status;

  return (
    <div className={variant === "card" ? ui.card : undefined}>
      <div className={variant === "page" ? "mb-6" : undefined}>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          First-time setup
        </p>
        <h2
          className={cn(
            "mt-1 font-semibold text-zinc-900",
            variant === "page" ? "text-2xl font-bold tracking-tight" : "text-lg"
          )}
        >
          Complete your tutor profile
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {completedCount} of {totalCount} complete — finish these so students can book and get to
          know you.
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      <ul className={cn("space-y-3", variant === "card" ? "mt-5" : "mt-0")}>
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4",
              item.complete
                ? "border-emerald-200/80 bg-emerald-50/50"
                : "border-zinc-200/80 bg-white"
            )}
          >
            <SetupStatusIcon complete={item.complete} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-zinc-900">{item.title}</p>
              <p className="mt-0.5 text-sm text-zinc-500">{item.description}</p>
              {!item.complete ? (
                <Link
                  href={item.href}
                  className="mt-3 inline-flex text-sm font-semibold text-violet-600 hover:text-violet-500"
                >
                  Complete this step →
                </Link>
              ) : (
                <p className="mt-2 text-xs font-medium uppercase tracking-wider text-emerald-700">
                  Done
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SetupStatusIcon({ complete }: { complete: boolean }) {
  if (complete) {
    return (
      <span
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
        aria-hidden="true"
      >
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <path
            d="M3.5 8.5L6.5 11.5L12.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 bg-white"
      aria-hidden="true"
    />
  );
}
