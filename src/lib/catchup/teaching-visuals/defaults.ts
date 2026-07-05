import type {
  ActivitySceneConfig,
  IconHeroConfig,
  PhraseShowcaseConfig,
  QuizBannerConfig,
  RecapBannerConfig,
  ConjugationTableConfig,
  TeachingVisualConfig,
  TeachingVisualType,
  ZoneDiagramConfig,
} from "./types";

export function defaultTeachingVisualConfig(
  type: TeachingVisualType
): TeachingVisualConfig {
  switch (type) {
    case "icon_hero":
      return { icons: ["Sparkles"], label: "Segment title", accentColor: "purple" };
    case "zone_diagram":
      return {
        zones: [
          { icon: "Circle", label: "Zone 1", sublabel: "Description", color: "gray" },
          { icon: "TrendingUp", label: "Zone 2", sublabel: "Description", color: "amber" },
          { icon: "Rocket", label: "Zone 3", sublabel: "Description", color: "green" },
        ],
      };
    case "phrase_showcase":
      return {
        items: [
          { icon: "Hand", label: "Phrase 1" },
          { icon: "User", label: "Phrase 2" },
        ],
      };
    case "activity_scene":
      return { icons: ["Sparkles"], caption: "Activity caption" };
    case "recap_banner":
      return {
        icon: "CheckCircle2",
        heading: "You can now...",
        subheading: "What the learner achieved",
      };
    case "quiz_banner":
      return { icon: "ClipboardCheck", heading: "Quick recap quiz" };
    case "conjugation_table":
      return {
        title: "Conjugation reference",
        columns: ["Pronoun", "Masculine", "Feminine", "Auxiliary"],
        rows: [{ Pronoun: "I", Masculine: "da", Feminine: "di", Auxiliary: "haa" }],
      };
    default:
      return { icons: ["Sparkles"], label: "Segment title", accentColor: "purple" };
  }
}

export function normalizeTeachingVisualConfig(
  type: TeachingVisualType,
  raw: unknown
): TeachingVisualConfig {
  if (!raw || typeof raw !== "object") {
    return defaultTeachingVisualConfig(type);
  }

  const config = raw as TeachingVisualConfig;

  switch (type) {
    case "icon_hero": {
      const value = config as IconHeroConfig;
      return {
        icons: Array.isArray(value.icons) && value.icons.length > 0 ? value.icons : ["Sparkles"],
        label: value.label?.trim() || "Segment title",
        accentColor: value.accentColor || "purple",
      };
    }
    case "zone_diagram": {
      const value = config as ZoneDiagramConfig;
      return {
        zones:
          Array.isArray(value.zones) && value.zones.length > 0
            ? value.zones
            : (defaultTeachingVisualConfig("zone_diagram") as ZoneDiagramConfig).zones,
      };
    }
    case "phrase_showcase": {
      const value = config as PhraseShowcaseConfig;
      return {
        items:
          Array.isArray(value.items) && value.items.length > 0
            ? value.items
            : (defaultTeachingVisualConfig("phrase_showcase") as PhraseShowcaseConfig).items,
      };
    }
    case "activity_scene": {
      const value = config as ActivitySceneConfig;
      return {
        icons: Array.isArray(value.icons) && value.icons.length > 0 ? value.icons : ["Sparkles"],
        caption: value.caption?.trim() || "Activity caption",
      };
    }
    case "recap_banner": {
      const value = config as RecapBannerConfig;
      return {
        icon: value.icon?.trim() || "CheckCircle2",
        heading: value.heading?.trim() || "You can now...",
        subheading: value.subheading?.trim() || "What the learner achieved",
      };
    }
    case "quiz_banner": {
      const value = config as QuizBannerConfig;
      return {
        icon: value.icon?.trim() || "ClipboardCheck",
        heading: value.heading?.trim() || "Quick recap quiz",
      };
    }
    case "conjugation_table": {
      const value = config as ConjugationTableConfig;
      return {
        title: value.title?.trim() || "Conjugation reference",
        columns:
          Array.isArray(value.columns) && value.columns.length > 0
            ? value.columns
            : (defaultTeachingVisualConfig("conjugation_table") as ConjugationTableConfig).columns,
        rows:
          Array.isArray(value.rows) && value.rows.length > 0
            ? value.rows
            : (defaultTeachingVisualConfig("conjugation_table") as ConjugationTableConfig).rows,
      };
    }
    default:
      return defaultTeachingVisualConfig(type);
  }
}
