import {
  AUTH_RECOVERY_COOKIE,
  authCallbackNextPath,
} from "@/lib/auth/recovery-flow";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams: Promise<{
    code?: string;
    type?: string;
    error_description?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  if (params.code) {
    const cookieStore = await cookies();
    const hasRecoveryCookie =
      cookieStore.get(AUTH_RECOVERY_COOKIE)?.value === "1";
    const next = authCallbackNextPath(params.type ?? null, hasRecoveryCookie);
    redirect(
      `/auth/callback?next=${encodeURIComponent(next)}&code=${encodeURIComponent(params.code)}`
    );
  }

  if (params.error_description) {
    const cookieStore = await cookies();
    const hasRecoveryCookie =
      cookieStore.get(AUTH_RECOVERY_COOKIE)?.value === "1";
    const dest =
      authCallbackNextPath(params.type ?? null, hasRecoveryCookie) === "/reset-password"
        ? "/reset-password"
        : "/login";
    redirect(`${dest}?error_description=${encodeURIComponent(params.error_description)}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-6 py-24">
      <div className="text-center">
        <div className="flex justify-center">
          <KiddaLogo variant="logo" size="lg" />
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          Your community membership platform
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-500">
          Access exclusive content, events, quizzes, and more.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Link
          href="/login"
          className="rounded-lg bg-violet-600 px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-violet-500"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-zinc-300 bg-white px-6 py-3 text-center text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
