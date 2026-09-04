export type GuestFeedbackSubmitConfig = {
  slug: string;
  submitUrl: string;
  fullName: string;
  email: string;
  phone: string;
  cohorts: string[];
  tutors: readonly string[];
  uploadPhoto?: (file: File) => Promise<string>;
};
