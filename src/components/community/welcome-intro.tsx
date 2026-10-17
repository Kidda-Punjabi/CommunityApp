import { Gamepad2, Trophy, Users, Video } from "lucide-react";

const GIFTS = [
  { label: "A weekly live session with Arsh", icon: Video },
  { label: "Your own pod", icon: Users },
  { label: "Games and breakout rooms", icon: Gamepad2 },
  { label: "Streaks and trophies", icon: Trophy },
] as const;

export function WelcomeIntro() {
  return (
    <div className="min-w-0">
      <img src="/logo/kidda-peacock.png" alt="" className="h-16 w-16 shrink-0 object-contain" />
      <p className="mt-4 font-heading text-3xl font-extrabold">Ji aayan nu!</p>
      <h1 className="mt-1 font-heading text-2xl font-extrabold">Welcome to the Kidda Community</h1>
      <ul className="mt-5 space-y-2">
        {GIFTS.map((gift) => {
          const Icon = gift.icon;
          return (
            <li key={gift.label} className="flex min-w-0 items-center gap-3 rounded-[20px] bg-white px-4 py-3 text-sm font-semibold">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F1ECFF] text-[#5B21B6]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">{gift.label}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-[#4A3F66]">Two quick questions and you&apos;re in. About 3 minutes.</p>
    </div>
  );
}
