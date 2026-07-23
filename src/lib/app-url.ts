function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Canonical app origin from env (referrals, Stripe, auth, calendar OAuth when headers unavailable).
 * Production should be NEXT_PUBLIC_APP_URL=https://kidda.app once that domain points at this app.
 */
export function getPublicAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return stripTrailingSlash(configured);
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return `https://${stripTrailingSlash(productionHost)}`;
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${stripTrailingSlash(vercelHost)}`;
  }

  return "http://localhost:3000";
}

export function getReferralShareUrl(code: string, baseUrl: string): string {
  return `${stripTrailingSlash(baseUrl)}/signup?ref=${encodeURIComponent(code)}`;
}
