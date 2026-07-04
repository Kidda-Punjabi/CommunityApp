import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";

export function FlashcardAccessDenied({
  requiredCourseLabel,
}: {
  requiredCourseLabel: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        These flashcards require {requiredCourseLabel ?? "a membership upgrade"}.
      </p>
      <Link
        href="/dashboard/membership"
        className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        View membership plans →
      </Link>
    </div>
  );
}

export function FlashcardDeckEmpty() {
  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        No flashcards linked to this lesson yet. In admin, assign flashcards to this
        lesson when creating them.
      </p>
      <BackLink fallbackHref="/dashboard/games" className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-500">
        ← Back
      </BackLink>
    </div>
  );
}
