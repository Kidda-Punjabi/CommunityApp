import Link from "next/link";
import { HubCard } from "@/components/ui/hub-primitives";

export function PlacementReminderBanner() {
  return (
    <HubCard className="border-amber-200 bg-amber-50">
      <p className="text-sm font-medium text-amber-950">
        You still need to complete your placement test
      </p>
      <p className="mt-1 text-sm text-amber-900">
        Finish the short check so we can confirm your starting level.
      </p>
      <Link
        href="/dashboard/placement"
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        Continue placement test
      </Link>
    </HubCard>
  );
}
