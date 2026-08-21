import {
  AUTH_RECOVERY_COOKIE,
  authCallbackNextPath,
} from "@/lib/auth/recovery-flow";
import { getContinueAsUser } from "@/lib/auth/continue-as-user";
import { MarketingLanding } from "@/components/marketing/marketing-landing";
import { cookies } from "next/headers";
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

  const continueAs = await getContinueAsUser();

  // Already signed in — skip the marketing "Continue as…" gate entirely.
  if (continueAs?.sessionActive) {
    redirect("/dashboard/learn");
  }

  return <MarketingLanding continueAs={continueAs} />;
}
