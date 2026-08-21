import { KiddaLogo } from "@/components/branding/kidda-logo";
import { HOW_IT_WORKS_CONTENT as C } from "@/lib/marketing/how-it-works-content";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type HowItWorksPageProps = {
  isLoggedIn: boolean;
};

export function HowItWorksPage({ isLoggedIn }: HowItWorksPageProps) {
  const homeHref = isLoggedIn ? "/dashboard/learn" : "/";

  return (
    <div className="how-it-works min-h-dvh text-zinc-900">
      <header className="relative z-10 border-b border-white/40 bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <KiddaLogo variant="logo" size="sm" href={homeHref} />
          {isLoggedIn ? (
            <Link href="/dashboard/learn" className="text-sm font-semibold text-violet-700">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-violet-700">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main>
        {/* Hero — brand-first, one composition */}
        <section className="how-it-works-hero relative overflow-hidden px-5 pb-16 pt-12 sm:pb-20 sm:pt-16">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-violet-300/30 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-amber-200/40 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#f4f0fb] to-transparent" />
          </div>

          <div className="relative mx-auto max-w-2xl text-center">
            <p className="how-it-works-fade font-heading text-sm font-semibold uppercase tracking-[0.28em] text-violet-700">
              Kidda
            </p>
            <h1 className="how-it-works-fade how-it-works-fade-delay-1 mt-5 font-heading text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl sm:leading-[1.15]">
              {C.hero.title}
            </h1>
            <p className="how-it-works-fade how-it-works-fade-delay-2 mx-auto mt-5 max-w-lg text-base leading-relaxed text-zinc-600 sm:text-lg">
              {C.hero.body}
            </p>
          </div>
        </section>

        {/* Common pitfalls */}
        <section className="border-t border-zinc-200/60 bg-white/70 px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">
              {C.pitfalls.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-zinc-600">{C.pitfalls.intro}</p>

            <ol className="mt-10 space-y-8">
              {C.pitfalls.items.map((item, index) => (
                <li key={item.title} className="flex gap-4">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 font-heading text-sm font-bold text-violet-800"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-zinc-900">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How we help */}
        <section className="border-t border-zinc-200/60 bg-gradient-to-b from-violet-50/80 to-[#f4f0fb] px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">
              {C.howWeHelp.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-zinc-600">{C.howWeHelp.intro}</p>

            <div className="mt-10 space-y-6">
              {C.howWeHelp.items.map((item) => (
                <div key={item.title}>
                  <h3 className="font-heading text-lg font-semibold text-violet-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 sm:text-base">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Recommended path */}
        <section className="border-t border-zinc-200/60 bg-white px-5 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-zinc-900">
              {C.path.title}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-zinc-600">{C.path.intro}</p>

            <ul className="mt-10 space-y-4">
              {C.path.options.map((option) => {
                const href = isLoggedIn ? option.hrefLoggedIn : option.hrefLoggedOut;
                return (
                  <li key={option.name}>
                    <Link
                      href={href}
                      className={`${ui.cardInteractive} flex items-start justify-between gap-4`}
                    >
                      <div>
                        <p className="font-heading text-lg font-semibold text-zinc-900">
                          {option.name}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600">{option.description}</p>
                      </div>
                      <span className="mt-1 shrink-0 text-sm font-semibold text-violet-600">
                        Explore →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-zinc-200/60 bg-violet-700 px-5 py-16 text-white sm:py-20">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {C.cta.title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-violet-100">
              {C.cta.body}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href={C.cta.primaryHref}
                className={`${pressable} inline-flex items-center justify-center rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-violet-700 shadow-lg transition hover:bg-violet-50`}
              >
                {C.cta.primaryLabel}
              </Link>
              {!isLoggedIn ? (
                <Link
                  href={C.cta.secondaryHref}
                  className={`${pressable} inline-flex items-center justify-center rounded-full border border-white/40 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10`}
                >
                  {C.cta.secondaryLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/60 bg-[#f4f0fb] px-5 py-6 text-center text-sm text-zinc-500">
        <Link href={homeHref} className="font-medium text-violet-700 hover:text-violet-600">
          ← Back to home
        </Link>
      </footer>
    </div>
  );
}

const pressable =
  "active:scale-[0.98] transition-transform duration-150 ease-out";
