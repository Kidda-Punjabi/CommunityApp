import type { AppOnboardingMilestoneKey, AppOnboardingMilestones } from "./types";

export type AppOnboardingMilestoneColumn = {
  key: AppOnboardingMilestoneKey;
  label: string;
  header: string;
  description: string;
};

export const APP_ONBOARDING_MILESTONE_COLUMNS: AppOnboardingMilestoneColumn[] = [
  {
    key: "signedUp",
    label: "Signed up",
    header: "Signup",
    description: "Account created (auth.users)",
  },
  {
    key: "emailConfirmed",
    label: "Email confirmed",
    header: "Email",
    description: "Email address verified (auth.users.email_confirmed_at)",
  },
  {
    key: "profileFilled",
    label: "Profile filled in",
    header: "Profile",
    description: "Name plus preferred name or avatar on their profile",
  },
  {
    key: "placementDone",
    label: "Level found",
    header: "Level",
    description: "Has a Kidda Level (profiles.kidda_level)",
  },
  {
    key: "practiced",
    label: "Practised in app",
    header: "Practice",
    description: "At least one game, quiz, or topic practice session recorded",
  },
];

export const APP_ONBOARDING_MILESTONE_KEYS = APP_ONBOARDING_MILESTONE_COLUMNS.map(
  (column) => column.key
);

type ProfileSnapshot = {
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  kidda_level: number | null;
};

export function isProfileFilledForAppOnboarding(profile: ProfileSnapshot): boolean {
  const fullName = profile.full_name?.trim();
  if (!fullName) return false;
  return Boolean(profile.preferred_name?.trim() || profile.avatar_url?.trim());
}

export function computeAppOnboardingMilestones(input: {
  hasAccount: boolean;
  emailConfirmedAt: string | null | undefined;
  profile: ProfileSnapshot;
  practiced: boolean;
}): AppOnboardingMilestones {
  return {
    signedUp: input.hasAccount,
    emailConfirmed: Boolean(input.emailConfirmedAt),
    profileFilled: isProfileFilledForAppOnboarding(input.profile),
    placementDone: input.profile.kidda_level != null,
    practiced: input.practiced,
  };
}

export function appOnboardingProgress(milestones: AppOnboardingMilestones): {
  done: number;
  total: number;
} {
  const total = APP_ONBOARDING_MILESTONE_KEYS.length;
  const done = APP_ONBOARDING_MILESTONE_KEYS.filter((key) => milestones[key]).length;
  return { done, total };
}

export function isAppOnboardingComplete(milestones: AppOnboardingMilestones): boolean {
  return APP_ONBOARDING_MILESTONE_KEYS.every((key) => milestones[key]);
}
