import { TIER_LABELS } from "@/lib/membership/tiers";
import { courseIdsForTiers } from "@/lib/membership/courses";
import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
} from "@/lib/membership/unlocked";
import { getCourseCatalog } from "@/lib/stripe/products";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function MembershipPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    try {
      await syncStripePurchasesForUser(user.id, user.email);
    } catch {
      // Stripe sync is best-effort; page still loads from existing access rows.
    }
  }

  const access = await getCourseAccessContext(supabase, user!);
  const catalog = getCourseCatalog();

  function ownsCatalogCourse(tier: (typeof catalog)[number]["tier"]) {
    const ids = courseIdsForTiers(access.courses, [tier]);
    return [...ids].some((id) => access.unlockedCourseIds.has(id));
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mb-6">
        <Link
          href="/dashboard/profile"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to profile
        </Link>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          Courses
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Purchases are checked automatically from Stripe. You own:{" "}
          <span className="font-semibold text-violet-600">
            {formatUnlockedCourseNames(access.courses, access.unlockedCourseIds)}
          </span>
        </p>
      </div>

      <div className="space-y-4">
        {catalog.map((course) => {
          const owned = ownsCatalogCourse(course.tier);

          return (
            <div
              key={course.tier}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-semibold text-zinc-900">{course.label}</h2>
              <p className="mt-1 text-sm text-zinc-500">{course.description}</p>
              {owned ? (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <p className="text-sm font-medium text-green-700">
                    Unlocked — go to Learn to start
                  </p>
                  <Link
                    href="/dashboard/learn"
                    className="text-sm font-semibold text-violet-600 hover:text-violet-500"
                  >
                    Open Learn →
                  </Link>
                </div>
              ) : course.learnMoreUrl ? (
                <a
                  href={course.learnMoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
                >
                  Find out more about {TIER_LABELS[course.tier]} →
                </a>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  Learn-more link not configured yet.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
