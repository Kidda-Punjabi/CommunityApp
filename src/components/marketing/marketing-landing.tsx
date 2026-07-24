import { ContinueAsUserCard } from "@/components/auth/continue-as-user-card";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import { LandingHighlights } from "@/components/marketing/landing-highlights";
import { LandingMascot } from "@/components/marketing/landing-mascot";
import type { ContinueAsUser } from "@/lib/auth/continue-as-user";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type MarketingLandingProps = {
  continueAs: ContinueAsUser | null;
};

export function MarketingLanding({ continueAs }: MarketingLandingProps) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <KiddaLogo variant="logo" size="sm" href="/" />
          {!continueAs ? (
            <Link href="/login" className="text-sm font-semibold text-violet-600 hover:text-violet-500">
              Sign in
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pt-16">
        <section className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10 xl:gap-16">
          <div className="text-center lg:text-left">
            <p className="inline-flex rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold text-violet-800">
              Free to start, no card needed
            </p>
            <h1 className="mt-5 font-heading text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-[2.75rem] lg:leading-[1.1]">
              Learn Punjabi the fun way
            </h1>
            <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-zinc-600 lg:mx-0">
              Play games, join live classes, and build a streak with people who get it.
            </p>

            <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              {continueAs ? (
                <ContinueAsUserCard user={continueAs} variant="home" />
              ) : (
                <>
                  <Link href="/signup" className={`${ui.btnPrimary} w-full sm:w-auto`}>
                    Create account
                  </Link>
                  <Link href="/how-it-works" className={`${ui.btnSecondary} w-full sm:w-auto`}>
                    See how it works
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="order-first lg:order-none">
            <LandingMascot />
          </div>
        </section>

        <LandingHighlights />
      </main>
    </div>
  );
}
