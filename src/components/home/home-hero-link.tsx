"use client";

import { NavLink } from "@/components/ui/nav-link";
import { ui } from "@/lib/ui/styles";

type HomeHeroLinkProps = {
  href: string;
  label: string;
};

export function HomeHeroLink({ href, label }: HomeHeroLinkProps) {
  return (
    <NavLink href={href} className={ui.heroCard}>
      <span className={ui.heroBadge}>Up next</span>
      <p className={ui.heroTitle}>{label}</p>
      <p className={ui.heroSubtitle}>Tap to continue your learning</p>
      <span className={ui.heroCta}>Get started →</span>
    </NavLink>
  );
}
