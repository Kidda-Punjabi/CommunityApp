import Link from "next/link";

export function TutorSetupBanner() {
  return (
    <div className="border-b border-violet-200/70 bg-violet-600">
      <Link
        href="/dashboard/tutor/setup"
        className="mx-auto flex max-w-lg items-center justify-between gap-3 px-5 py-3 text-sm text-white transition-colors hover:bg-violet-500/90"
      >
        <span>
          <span className="font-semibold">Complete your tutor setup</span>
          <span className="hidden sm:inline"> — bio, photo, calendar &amp; availability</span>
        </span>
        <span className="shrink-0 font-semibold" aria-hidden="true">
          →
        </span>
      </Link>
    </div>
  );
}
