/** Canonical app origin for share links, auth redirects, and Stripe return URLs. */
export function getPublicAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const vercelHost = process.env.VERCEL_URL?.trim();
  if (vercelHost) {
    return `https://${vercelHost.replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
