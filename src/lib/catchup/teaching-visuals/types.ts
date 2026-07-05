export const TEACHING_VISUAL_TYPES = [
  "icon_hero",
  "zone_diagram",
  "phrase_showcase",
  "activity_scene",
  "recap_banner",
  "quiz_banner",
  "conjugation_table",
] as const;

export type TeachingVisualType = (typeof TEACHING_VISUAL_TYPES)[number];

export const TEACHING_VISUAL_TYPE_LABELS: Record<TeachingVisualType, string> = {
  icon_hero: "Icon hero",
  zone_diagram: "Zone diagram",
  phrase_showcase: "Phrase showcase",
  activity_scene: "Activity scene",
  recap_banner: "Recap banner",
  quiz_banner: "Quiz banner",
  conjugation_table: "Conjugation table",
};

export type VisualAccentColor = "purple" | "teal" | "coral" | "gray" | "amber" | "green";

export type IconHeroConfig = {
  icons: string[];
  label: string;
  accentColor: VisualAccentColor;
};

export type ZoneDiagramConfig = {
  zones: Array<{
    icon: string;
    label: string;
    sublabel: string;
    color: VisualAccentColor;
  }>;
};

export type PhraseShowcaseConfig = {
  items: Array<{ icon: string; label: string }>;
};

export type ActivitySceneConfig = {
  icons: string[];
  caption: string;
};

export type RecapBannerConfig = {
  icon: string;
  heading: string;
  subheading: string;
};

export type QuizBannerConfig = {
  icon: string;
  heading: string;
};

export type ConjugationTableConfig = {
  title?: string;
  columns: string[];
  rows: Array<Record<string, string>>;
};

export type TeachingVisualConfig =
  | IconHeroConfig
  | ZoneDiagramConfig
  | PhraseShowcaseConfig
  | ActivitySceneConfig
  | RecapBannerConfig
  | QuizBannerConfig
  | ConjugationTableConfig;

export type TeachingVisual = {
  type: TeachingVisualType;
  config: TeachingVisualConfig;
};

export function parseTeachingVisual(
  type: string | null | undefined,
  config: unknown
): TeachingVisual | null {
  if (!type || !TEACHING_VISUAL_TYPES.includes(type as TeachingVisualType)) {
    return null;
  }

  if (!config || typeof config !== "object") {
    return null;
  }

  return {
    type: type as TeachingVisualType,
    config: config as TeachingVisualConfig,
  };
}
