import { KiddaLogo } from "@/components/branding/kidda-logo";
import { BuyButton } from "@/components/products/buy-button";
import { ProductCheckoutSection } from "@/components/products/product-checkout-section";
import { ProductFaq } from "@/components/products/product-faq";
import {
  isCheckoutConfigured,
  isEmbeddedCheckoutConfigured,
} from "@/lib/products/checkout";
import type { ProductPageContent } from "@/lib/products/content";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type ProductLandingProps = {
  content: ProductPageContent;
  isLoggedIn: boolean;
  owned?: boolean;
  fallbackCheckoutUrl?: string | null;
};

function checkoutOptionsForContent(content: ProductPageContent) {
  if (content.pricingTiers?.length) {
    return content.pricingTiers.map((tier) => ({
      key: tier.checkoutKey,
      label: tier.name,
    }));
  }

  if (content.singlePrice) {
    return [
      {
        key: content.singlePrice.checkoutKey,
        label: content.singlePrice.label,
      },
    ];
  }

  return [];
}

function primaryCheckoutKey(content: ProductPageContent): string | null {
  const highlighted = content.pricingTiers?.find((tier) => tier.highlight);
  if (highlighted) return highlighted.checkoutKey;
  if (content.pricingTiers?.[0]) return content.pricingTiers[0].checkoutKey;
  if (content.singlePrice) return content.singlePrice.checkoutKey;
  return null;
}

export function ProductLanding({
  content,
  isLoggedIn,
  owned = false,
  fallbackCheckoutUrl,
}: ProductLandingProps) {
  const checkoutOptions = checkoutOptionsForContent(content);
  const showEmbeddedCheckout = checkoutOptions.some((option) =>
    isEmbeddedCheckoutConfigured(option.key)
  );
  const primaryKey = primaryCheckoutKey(content);

  function tierCta(checkoutKey: string, label = "Buy Now") {
    return (
      <BuyButton
        checkoutKey={checkoutKey}
        label={label}
        configured={isCheckoutConfigured(checkoutKey)}
        fallbackUrl={fallbackCheckoutUrl}
      />
    );
  }

  function heroCta() {
    if (primaryKey) {
      return (
        <BuyButton
          checkoutKey={primaryKey}
          label={content.heroCta}
          configured={isCheckoutConfigured(primaryKey)}
          fallbackUrl={fallbackCheckoutUrl}
          className={ui.btnPrimaryBlock}
        />
      );
    }

    return (
      <Link href="/signup" className={ui.btnPrimaryBlock}>
        {content.heroCta}
      </Link>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 via-white to-zinc-50">
      <header className="border-b border-violet-100/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href={isLoggedIn ? "/dashboard/home" : "/"} className="flex items-center gap-2">
            <KiddaLogo variant="logo" size="sm" />
          </Link>
          {isLoggedIn ? (
            <Link href="/dashboard/profile/billing" className="text-sm font-medium text-violet-600">
              Billing
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-medium text-violet-600">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-8 pb-16">
        <section className="text-center">
          {content.heroBadge && (
            <p className="inline-flex rounded-full bg-violet-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-violet-700">
              {content.heroBadge}
            </p>
          )}
          <h1 className="mt-4 font-heading text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            {content.heroTitle}
          </h1>
          {content.heroHighlight && (
            <p className="mt-2 font-heading text-2xl font-bold text-violet-600 sm:text-3xl">
              {content.heroHighlight}
            </p>
          )}
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-zinc-600">
            {content.heroSubtitle}
          </p>
          {content.scheduleNote && (
            <p className="mt-3 text-sm font-medium text-violet-700">{content.scheduleNote}</p>
          )}
          {owned ? (
            <div className="mt-8 rounded-3xl border border-green-200 bg-green-50 px-6 py-5">
              <p className="font-semibold text-green-800">You already have access</p>
              <Link href="/dashboard/learn" className={`mt-4 ${ui.btnPrimary}`}>
                Go to Learn →
              </Link>
            </div>
          ) : (
            <div className="mt-8">{heroCta()}</div>
          )}
        </section>

        {content.features.length > 0 && (
          <section className="mt-14">
            {content.featuresSectionTitle && (
              <h2 className="mb-6 text-center font-heading text-xl font-bold text-zinc-900">
                {content.featuresSectionTitle}
              </h2>
            )}
            <div className="space-y-4">
              {content.features.map((feature) => (
                <div key={feature.title} className={ui.card}>
                  {feature.icon && (
                    <span className="text-2xl" role="img" aria-hidden="true">
                      {feature.icon}
                    </span>
                  )}
                  <h3 className="mt-2 font-semibold text-zinc-900">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {content.footerNote && (
          <p className="mt-6 text-center text-sm text-zinc-500">{content.footerNote}</p>
        )}

        {content.includedItems && content.includedItems.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-center font-heading text-xl font-bold text-zinc-900">
              {content.includedSectionTitle ?? "What's included"}
            </h2>
            <ul className={`${ui.card} space-y-3`}>
              {content.includedItems.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-zinc-700">
                  <span className="mt-0.5 shrink-0 text-violet-500" aria-hidden="true">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {content.curriculum && content.curriculum.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-center font-heading text-xl font-bold text-zinc-900">
              {content.curriculumSectionTitle ?? "Curriculum"}
            </h2>
            <div className="space-y-3">
              {content.curriculum.map((week) => (
                <div key={week.week} className={ui.cardBordered}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                    Week {week.week}
                  </p>
                  <h3 className="mt-1 font-semibold text-zinc-900">
                    <span className="mr-2" role="img" aria-hidden="true">
                      {week.emoji}
                    </span>
                    {week.title}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600">{week.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {content.audience && (
          <section className="mt-14">
            <h2 className="mb-4 text-center font-heading text-xl font-bold text-zinc-900">
              {content.audienceSectionTitle ?? "Who is this for?"}
            </h2>
            <div className={ui.card}>
              <p className="text-sm leading-relaxed text-zinc-700">{content.audience.title}</p>
              <ul className="mt-4 space-y-2">
                {content.audience.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-zinc-700">
                    <span className="shrink-0 text-green-600" aria-hidden="true">
                      ✅
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {!owned && (content.pricingTiers?.length || content.singlePrice) && (
          <section className="mt-14" id="pricing">
            <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Pricing
            </h2>
            {content.pricingSectionTitle && (
              <h3 className="mb-6 text-center font-heading text-xl font-bold text-zinc-900">
                {content.pricingSectionTitle}
              </h3>
            )}

            {content.singlePrice && !content.pricingTiers?.length && (
              <div className={`${ui.card} text-center`}>
                <h4 className="text-lg font-semibold text-zinc-900">{content.singlePrice.label}</h4>
                <p className="mt-2 text-3xl font-bold text-violet-600">{content.singlePrice.price}</p>
                {content.singlePrice.priceNote && (
                  <p className="mt-1 text-sm text-zinc-500">{content.singlePrice.priceNote}</p>
                )}
                <div className="mt-6">
                  {tierCta(content.singlePrice.checkoutKey)}
                </div>
              </div>
            )}

            {content.pricingTiers && content.pricingTiers.length > 0 && (
              <div
                className={
                  content.pricingTiers.length > 1
                    ? "grid gap-4 sm:grid-cols-2"
                    : "mx-auto max-w-md"
                }
              >
                {content.pricingTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className={
                      tier.highlight
                        ? "rounded-3xl border-2 border-violet-300 bg-white p-6 shadow-[0_8px_32px_-8px_rgba(124,58,237,0.2)]"
                        : ui.cardBordered
                    }
                  >
                    <h4 className="text-lg font-semibold text-zinc-900">{tier.name}</h4>
                    <p className="mt-2 text-3xl font-bold text-violet-600">{tier.price}</p>
                    {tier.priceNote && (
                      <p
                        className="mt-1 text-sm text-zinc-500"
                        dangerouslySetInnerHTML={{
                          __html: tier.priceNote.replace(/~~(.+?)~~/g, "<s>$1</s>"),
                        }}
                      />
                    )}
                    <ul className="mt-4 space-y-2">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex gap-2 text-sm text-zinc-700">
                          <span className="shrink-0 text-violet-500" aria-hidden="true">
                            ✓
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6">{tierCta(tier.checkoutKey)}</div>
                  </div>
                ))}
              </div>
            )}

            {!owned && showEmbeddedCheckout && checkoutOptions.length > 0 && (
              <ProductCheckoutSection
                options={checkoutOptions}
                defaultKey={primaryKey ?? undefined}
              />
            )}
          </section>
        )}

        {content.faq.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-6 text-center font-heading text-xl font-bold text-zinc-900">
              Frequently asked questions
            </h2>
            <ProductFaq items={content.faq} />
          </section>
        )}

        {!owned && (
          <section className="mt-14 text-center">
            {primaryKey && heroCta()}
          </section>
        )}

        <footer className="mt-16 border-t border-zinc-200 pt-8 text-center text-xs text-zinc-400">
          <p>Copyright 2026 | Gurupma Singh</p>
          <p className="mt-1">
            <a href="https://kidda.app/privacy" className="hover:text-violet-600">
              Privacy Policy
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
