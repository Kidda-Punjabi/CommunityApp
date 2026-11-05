import Link from "next/link";
import { HubCard } from "@/components/ui/hub-primitives";

export function PlacementReminderBanner() {
  return (
    <HubCard className="border-amber-200 bg-amber-50">
      <p className="text-sm font-medium text-amber-950">
        You still need to find your level
      </p>
      <p className="mt-1 text-sm text-amber-900">
        Answer a few quick questions so we can show you what to work on.
      </p>
      <Link
        href="/dashboard/community/placement?from=practice"
        className="mt-3 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        Find your level
      </Link>
    </HubCard>
  );
}
