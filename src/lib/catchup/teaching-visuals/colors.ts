import type { VisualAccentColor } from "./types";

export const VISUAL_ACCENT_COLORS: VisualAccentColor[] = [
  "purple",
  "teal",
  "coral",
  "gray",
  "amber",
  "green",
];

type AccentStyle = {
  surface: string;
  icon: string;
  text: string;
  border: string;
};

const ACCENT_STYLES: Record<VisualAccentColor, AccentStyle> = {
  purple: {
    surface: "bg-violet-50",
    icon: "text-violet-600",
    text: "text-violet-900",
    border: "border-violet-200",
  },
  teal: {
    surface: "bg-teal-50",
    icon: "text-teal-600",
    text: "text-teal-900",
    border: "border-teal-200",
  },
  coral: {
    surface: "bg-orange-50",
    icon: "text-orange-600",
    text: "text-orange-900",
    border: "border-orange-200",
  },
  gray: {
    surface: "bg-zinc-100",
    icon: "text-zinc-600",
    text: "text-zinc-800",
    border: "border-zinc-200",
  },
  amber: {
    surface: "bg-amber-50",
    icon: "text-amber-600",
    text: "text-amber-900",
    border: "border-amber-200",
  },
  green: {
    surface: "bg-emerald-50",
    icon: "text-emerald-600",
    text: "text-emerald-900",
    border: "border-emerald-200",
  },
};

export function accentStyle(color: VisualAccentColor | string | undefined): AccentStyle {
  if (color && color in ACCENT_STYLES) {
    return ACCENT_STYLES[color as VisualAccentColor];
  }
  return ACCENT_STYLES.purple;
}
