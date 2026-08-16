import type { KidAgeTier, KidAvatarIcon } from "./constants";

export type KidProfile = {
  id: string;
  parent_user_id: string;
  name: string;
  avatar_icon: KidAvatarIcon;
  age_tier: KidAgeTier;
  created_at: string;
  updated_at: string;
};

export type KidSession = {
  activeKidProfile: KidProfile | null;
  hasPin: boolean;
  pinUnlocked: boolean;
};

export type KidSticker = {
  id: string;
  kid_profile_id: string;
  sticker_icon: string;
  sticker_name: string;
  earned_at: string;
};

export type KidProgressSummary = {
  profile: KidProfile;
  activitiesCompleted: number;
  stickersEarned: number;
  lastActiveAt: string | null;
};
