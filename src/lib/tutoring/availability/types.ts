export type TutorAvailabilitySettings = {
  tutorId: string;
  timezone: string;
  weeklyCapacityHours: number;
  defaultSessionMinutes: number;
  bookingBufferHours: number;
  bufferBetweenSessionsMinutes: number;
  oneToOneBookingEnabled: boolean;
  updatedAt: string | null;
};

export type TutorAvailabilityWindow = {
  id: string;
  tutorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TutorCapacitySummary = {
  weekLabel: string;
  weeklyCapacityHours: number;
  usedHours: number;
  remainingHours: number;
  utilizationPercent: number;
};

export type BookableSlot = {
  startsAt: string;
  endsAt: string;
  label: string;
};

export type TutorOneToOneBooking = {
  id: string;
  tutorId: string;
  studentId: string;
  startsAt: string;
  endsAt: string;
  status: "pending_payment" | "confirmed" | "cancelled";
  notes: string | null;
  createdAt: string;
};

export type StudentBookingContext = {
  tutorId: string;
  tutorName: string;
  enrollmentId: string | null;
  courseId: string | null;
  bookingEnabled: boolean;
  settings: TutorAvailabilitySettings | null;
  availableCredits: number;
  /** True when the student has credits but no tutor could be resolved for booking. */
  tutorUnresolved?: boolean;
};

export type TutorBookingCredit = {
  id: string;
  purchasedAt: string;
  status: "available" | "used";
  courseId: string | null;
  tutorId: string | null;
};

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
