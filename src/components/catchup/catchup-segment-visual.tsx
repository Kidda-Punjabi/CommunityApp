import { ActivitySceneVisual } from "@/components/catchup/teaching-visuals/activity-scene-visual";
import { IconHeroVisual } from "@/components/catchup/teaching-visuals/icon-hero-visual";
import { PhraseShowcaseVisual } from "@/components/catchup/teaching-visuals/phrase-showcase-visual";
import { QuizBannerVisual } from "@/components/catchup/teaching-visuals/quiz-banner-visual";
import { RecapBannerVisual } from "@/components/catchup/teaching-visuals/recap-banner-visual";
import { ZoneDiagramVisual } from "@/components/catchup/teaching-visuals/zone-diagram-visual";
import { ConjugationTableVisual } from "@/components/catchup/teaching-visuals/conjugation-table-visual";
import type {
  ActivitySceneConfig,
  ConjugationTableConfig,
  IconHeroConfig,
  PhraseShowcaseConfig,
  QuizBannerConfig,
  RecapBannerConfig,
  TeachingVisual,
  ZoneDiagramConfig,
} from "@/lib/catchup/teaching-visuals/types";

export function CatchupSegmentVisual({ visual }: { visual: TeachingVisual }) {
  switch (visual.type) {
    case "icon_hero":
      return <IconHeroVisual config={visual.config as IconHeroConfig} />;
    case "zone_diagram":
      return <ZoneDiagramVisual config={visual.config as ZoneDiagramConfig} />;
    case "phrase_showcase":
      return <PhraseShowcaseVisual config={visual.config as PhraseShowcaseConfig} />;
    case "activity_scene":
      return <ActivitySceneVisual config={visual.config as ActivitySceneConfig} />;
    case "recap_banner":
      return <RecapBannerVisual config={visual.config as RecapBannerConfig} />;
    case "quiz_banner":
      return <QuizBannerVisual config={visual.config as QuizBannerConfig} />;
    case "conjugation_table":
      return <ConjugationTableVisual config={visual.config as ConjugationTableConfig} />;
    default:
      return null;
  }
}
