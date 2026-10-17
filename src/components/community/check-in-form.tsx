"use client";

import { CheckInPanel } from "@/components/community/check-in-ui";

export function CheckInForm({ occurrenceId }: { occurrenceId?: string }) {
  return <CheckInPanel occurrenceId={occurrenceId} />;
}
