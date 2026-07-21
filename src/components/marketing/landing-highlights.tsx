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
    <section className="mt-16 border-t border-zinc-100 pt-12 lg:mt-20">
      <ul className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
          <li
            key={title}
            className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-5 py-5 text-center sm:text-left"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <p className="mt-3 font-heading text-sm font-semibold text-zinc-900">{title}</p>
            <p className="mt-1 text-sm leading-snug text-zinc-600">{description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
