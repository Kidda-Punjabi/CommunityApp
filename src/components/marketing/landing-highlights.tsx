import { Flame, Trophy, Users } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: Flame,
    title: "Keep your streak alive",
    description: "Short daily practice that fits real life.",
  },
  {
    icon: Users,
    title: "Learn with live classes",
    description: "Speak Punjabi with tutors and classmates.",
  },
  {
    icon: Trophy,
    title: "Climb the leaderboards",
    description: "Friendly competition with the community.",
  },
] as const;

export function LandingHighlights() {
  return (
    <section className="mt-10 border-t border-zinc-100 pt-8 sm:mt-16 sm:pt-12 lg:mt-20">
      <ul className="grid gap-3 sm:grid-cols-3 sm:gap-5">
        {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
          <li
            key={title}
            className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-4 text-center sm:px-5 sm:py-5 sm:text-left"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 sm:h-11 sm:w-11">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <p className="mt-2.5 font-heading text-sm font-semibold text-zinc-900 sm:mt-3">
              {title}
            </p>
            <p className="mt-1 text-sm leading-snug text-zinc-600">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
