import {
  Cat, Dog, Rabbit, Bird, Fish, Rocket, Star, Rainbow, Sun, Moon, Heart, Flower2,
  Sparkles, Trophy, Medal, Crown, Gem, Music, Smile, ThumbsUp, PartyPopper, Balloon,
  Cake, Apple, Cherry, TreePine, Cloud, Zap, Wand2, Footprints,
  type LucideIcon,
} from "lucide-react";
import type { KidAvatarIcon } from "@/lib/kids/constants";

const ICON_MAP: Record<string, LucideIcon> = {
  Cat, Dog, Rabbit, Bird, Fish, Rocket, Star, Rainbow, Sun, Moon, Heart, Flower2,
  Sparkles, Trophy, Medal, Crown, Gem, Music, Smile, ThumbsUp, PartyPopper, Balloon,
  Cake, Apple, Cherry, TreePine, Cloud, Zap, Wand2, Footprints,
};

export function KidLucideIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_MAP[name] ?? Star;
  return <Icon className={className} aria-hidden />;
}

export function isKnownKidIcon(name: string): name is KidAvatarIcon | string {
  return name in ICON_MAP;
}
