import "server-only";

import Link from "next/link";
import { KiddaLogoImage } from "@/components/branding/kidda-logo-image";
import { loadSiteBranding } from "@/lib/branding/load-site-branding";
import type { SiteBranding } from "@/lib/branding/types";

type KiddaLogoProps = {
  variant?: "logo" | "icon" | "wordmark";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  href?: string;
  branding?: SiteBranding;
};

export async function KiddaLogo({
  variant = "logo",
  size = "md",
  className = "",
  href,
  branding: brandingOverride,
}: KiddaLogoProps) {
  const branding = brandingOverride ?? (await loadSiteBranding());

  const inner = (
    <KiddaLogoImage variant={variant} size={size} className={className} branding={branding} />
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex shrink-0 items-center">
        {inner}
      </Link>
    );
  }

  return <span className={`inline-flex shrink-0 items-center ${className}`}>{inner}</span>;
}
