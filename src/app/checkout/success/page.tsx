import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
} from "@/lib/membership/unlocked";
import { formatCheckoutSuccessAccessLabel } from "@/lib/stripe/checkout-success-label";
import { syncMembershipFromCheckoutSession } from "@/lib/stripe/sync-membership";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/courses");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let syncError: string | null = null;

  try {
    await syncMembershipFromCheckoutSession(sessionId);
  } catch (error) {
    syncError = error instanceof Error ? error.message : "Could not sync membership.";
  }

  if (!user) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
          <span className="text-4xl" role="img" aria-hidden="true">
            🎉
          </span>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900">Payment successful!</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in or create an account with the <strong>same email</strong> you used at checkout
            to access your course in the app.
          </p>
          {syncError && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {syncError} Contact support if access does not appear after signing in.
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-violet-600 hover:text-violet-500"
            >
              Create account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const access = await getCourseAccessContext(supabase, user);
  const sessionPurchaseLabel = await formatCheckoutSuccessAccessLabel(user.id, sessionId);
  const accessLabel =
    sessionPurchaseLabel ??
    formatUnlockedCourseNames(access.courses, access.unlockedCourseIds);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <span className="text-4xl" role="img" aria-hidden="true">
          🎉
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-900">Purchase complete!</h1>
        <p className="mt-2 text-sm text-zinc-600">
          You now have access to:{" "}
          <span className="font-semibold text-violet-700">{accessLabel}</span>
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
