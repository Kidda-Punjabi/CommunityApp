import Link from "next/link";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { loadKidBedtimeStoriesForParent } from "@/lib/kids/bedtime-stories";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";
import { loadKidSession } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const activities = [
  {
    href: "/dashboard/kids/flashcards/study",
    icon: "Star",
    label: "Picture cards",
    description: "Tap, flip, and learn new words",
  },
  {
    href: "/dashboard/kids/speaking",
    icon: "Music",
    label: "Say it!",
    description: "Listen and repeat out loud",
  },
] as const;

export default async function KidsHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  const kid = session.activeKidProfile;
  if (!kid) redirect("/dashboard/profile/kids");

  const { stories, parentIsPremium, tableReady } = await loadKidBedtimeStoriesForParent(
    supabase,
    user.id,
    kid.age_tier
  );

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg">
          <KidLucideIcon name={kid.avatar_icon} className="h-12 w-12 text-sky-500" />
        </span>
        <h1 className="mt-4 text-3xl font-bold text-sky-900">Hi {kid.name}!</h1>
        <p className="mt-1 text-sky-700">What do you want to play?</p>
      </div>

      <div className="mt-8 space-y-4">
        {activities.map((activity) => (
          <Link
            key={activity.href}
            href={activity.href}
            className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-md ring-2 ring-transparent hover:ring-violet-300"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-violet-100">
              <KidLucideIcon name={activity.icon} className="h-9 w-9 text-violet-600" />
            </span>
            <span>
              <span className="block text-xl font-bold text-zinc-900">{activity.label}</span>
              <span className="text-sm text-zinc-500">{activity.description}</span>
            </span>
          </Link>
        ))}

        {kid.age_tier === "early_reader" && (
          <Link
            href="/dashboard/kids/match"
            className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-md hover:ring-2 hover:ring-amber-300"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100">
              <KidLucideIcon name="Gem" className="h-9 w-9 text-amber-600" />
            </span>
            <span>
              <span className="block text-xl font-bold text-zinc-900">Memory match</span>
              <span className="text-sm text-zinc-500">Find the matching pairs</span>
            </span>
          </Link>
        )}

        {tableReady ? (
          <section className="rounded-3xl bg-white p-5 shadow-md">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-zinc-900">Bedtime stories</h2>
              {!parentIsPremium ? (
                <Link
                  href={PREMIUM_UNLOCK_PATH}
                  className="text-xs font-semibold text-violet-600"
                >
                  Premium →
                </Link>
              ) : null}
            </div>
            {stories.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">
                Stories are coming soon — check back after a grown-up adds some.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stories.map((story) => (
                  <li
                    key={story.id}
                    className={`rounded-2xl px-3 py-3 text-sm ${
                      story.unlocked ? "bg-sky-50 text-sky-900" : "bg-zinc-50 text-zinc-500"
                    }`}
                  >
                    <span className="font-semibold">{story.title}</span>
                    {!story.unlocked ? (
                      <span className="mt-0.5 block text-xs">Unlock with Premium</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
