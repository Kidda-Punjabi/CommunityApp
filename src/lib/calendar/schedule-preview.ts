import type { BookableSlot } from "@/lib/tutoring/availability/types";

export type PreviewActionResult = { error?: string; success?: string };

export type RescheduleSubmitInput = {
  sessionId: string;
  message: string;
  lateCancel: boolean;
  requestedStartsAt: string | null;
  requestedEndsAt: string | null;
};

export type CohortSwitchSubmitInput = {
  sessionId: string;
  toSessionId: string;
  message: string;
};

export type SchedulePreviewHandlers = {
  onViewLesson?: (sessionId: string) => void;
  onRescheduleSubmit?: (input: RescheduleSubmitInput) => Promise<PreviewActionResult>;
  onCohortSwitchSubmit?: (input: CohortSwitchSubmitInput) => Promise<PreviewActionResult>;
  onCancelReschedule?: (requestId: string) => Promise<PreviewActionResult>;
  onCancelCohortSwitch?: (requestId: string) => Promise<PreviewActionResult>;
  loadSlots?: (sessionId: string) => Promise<{ slots: BookableSlot[]; error?: string }>;
};
