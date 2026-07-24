import {
  TOPICS_FREE_WEEK_COUNT,
  TOPICS_SUBSCRIPTION_UNLOCK_URL,
} from "@/lib/topics/access";
import { Lock, Circle } from "lucide-react";
import Link from "next/link";
import { ui } from "@/lib/ui/styles";

export type TopicsPathItem = {
  id: string;
  weekNumber: number;
  title: string;
  presentationUrl: string | null;
  unlocked: boolean;
};

type TopicsPathSectionProps = {
  items: TopicsPathItem[];
};

export function TopicsPathSection({ items }: TopicsPathSectionProps) {
  return (
    <section className="mb-10">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          Topics
        </p>
        <h2 className="mt-1 font-heading text-lg font-semibold text-zinc-900">
          Practical Punjabi, week by week
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          First {TOPICS_FREE_WEEK_COUNT} weeks free. Weeks {TOPICS_FREE_WEEK_COUNT + 1}
          –24 unlock with Premium.
        </p>
      </div>

      <ol className="relative mx-auto max-w-md space-y-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
              {!isLast ? (
                <span
                  className="absolute left-[1.15rem] top-10 bottom-0 w-0.5 bg-zinc-200"
                  aria-hidden
                />
              ) : null}

              <div
                className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                  item.unlocked
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400"
                }`}
              >
                {item.unlocked ? (
                  <Circle className="h-4 w-4 fill-violet-500 text-violet-500" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Week {item.weekNumber}
                </p>
                <p
                  className={`mt-0.5 font-medium ${
                    item.unlocked ? "text-zinc-900" : "text-zinc-500"
                  }`}
                >
                  {item.title}
                </p>

                {item.unlocked ? (
                  item.presentationUrl ? (
                    <a
                      href={item.presentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex text-sm font-semibold text-violet-600 hover:text-violet-500"
                    >
                      Open topic →
                    </a>
                  ) : (
                    <p className="mt-1.5 text-xs text-zinc-400">Content coming soon</p>
                  )
                ) : (
                  <div className="mt-2">
                    <p className="text-xs text-zinc-500">Locked</p>
                    <Link
                      href={TOPICS_SUBSCRIPTION_UNLOCK_URL}
                      className={`mt-1.5 inline-flex ${ui.btnSecondary} text-xs`}
                    >
                      Unlock with Premium
                    </Link>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
