import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
} from "@/lib/membership/unlocked";
import { syncMembershipFromCheckoutSession } from "@/lib/stripe/sync-membership";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function MembershipSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/dashboard/membership");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let syncError: string | null = null;

  try {
    await syncMembershipFromCheckoutSession(sessionId);
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Could not sync membership.";
  }

  const access = await getCourseAccessContext(supabase, user);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <span className="text-4xl" role="img" aria-hidden="true">
          🎉
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Purchase complete!</h1>
        <p className="mt-2 text-sm text-zinc-600">
          You now have access to:{" "}
          <span className="font-semibold text-violet-700">
            {formatUnlockedCourseNames(access.courses, access.unlockedCourseIds)}
          </span>
        </p>
        {access.unlockedCourseIds.size > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-zinc-600">
            {access.courses
              .filter((course) => access.unlockedCourseIds.has(course.id))
              .map((course) => (
                <li key={course.id}>{course.name} lessons & practice</li>
              ))}
          </ul>
        )}
        {syncError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {syncError} If access looks wrong, refresh in a moment or contact support.
          </p>
        )}
        <Link
          href="/dashboard/learn"
          className="mt-6 inline-block rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Go to Learn
        </Link>
      </div>
    </div>
  );
}
