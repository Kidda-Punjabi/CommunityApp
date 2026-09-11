export type GuestFeedbackSubmitConfig = {
  slug: string;
  submitUrl: string;
  fullName: string;
  email: string;
  phone: string;
  cohorts: string[];
  tutors: readonly string[];
  uploadPhoto?: (file: File) => Promise<string>;
  /** Replaces the empty cohort option label. Beginners keep the default. */
  cohortPlaceholder?: string;
};
