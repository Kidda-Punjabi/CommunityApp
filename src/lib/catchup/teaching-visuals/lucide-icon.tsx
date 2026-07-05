import * as LucideIcons from "lucide-react";
import { HelpCircle, type LucideIcon } from "lucide-react";

const ICON_MAP = LucideIcons as unknown as Record<string, LucideIcon>;

export function resolveLucideIcon(name: string): LucideIcon {
  const trimmed = name.trim();
  if (!trimmed) return HelpCircle;

  const direct = ICON_MAP[trimmed];
  if (direct) return direct;

  const pascal = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return ICON_MAP[pascal] ?? HelpCircle;
}

type CatchupLucideIconProps = {
  name: string;
  className?: string;
  strokeWidth?: number;
};

export function CatchupLucideIcon({
  name,
  className,
  strokeWidth = 1.75,
}: CatchupLucideIconProps) {
  const Icon = resolveLucideIcon(name);
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
