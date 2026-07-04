import { BackLink } from "@/components/navigation/back-link";
import { BookCallCard } from "@/components/booking/book-call-card";
import { TIER_LABELS } from "@/lib/membership/tiers";
import { courseIdsForTiers } from "@/lib/membership/courses";
import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
} from "@/lib/membership/unlocked";
import { productPath } from "@/lib/products/content";
import { getCourseCatalog } from "@/lib/stripe/products";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const TIER_TO_SLUG = {
  foundational: "foundational",
  beginners: "beginners",
  community: "community",
} as const;

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
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600 hover:text-violet-500">← Back to profile</BackLink>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          Courses
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          You own:{" "}
          <span className="font-semibold text-violet-600">
            {formatUnlockedCourseNames(access.courses, access.unlockedCourseIds)}
          </span>
        </p>
        <Link
          href="/dashboard/profile/billing"
          className="mt-2 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
        >
          Billing & purchases →
        </Link>
      </div>

      <div className="mb-6">
        <BookCallCard />
      </div>

      <div className="space-y-4">
        {catalog.map((course) => {
          const owned = ownsCatalogCourse(course.tier);
          const productPage = productPath(TIER_TO_SLUG[course.tier]);

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
              ) : (
                <BackLink fallbackHref={productPage} className="mt-4 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500">View {TIER_LABELS[course.tier]} →</BackLink>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
