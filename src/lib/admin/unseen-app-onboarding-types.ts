export type UnseenAppOnboardingRow = {
  userId: string;
  displayName: string;
  email: string | null;
  signedUpAt: string;
  stale: boolean;
};
