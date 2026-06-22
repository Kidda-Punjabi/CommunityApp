"use client";

import { loadAdminCohortLessons } from "@/app/admin/content/cohort-actions";
import { TutorLessonManager } from "@/components/tutor/tutor-lesson-manager";
import type { TutorLessonRow } from "@/lib/tutoring/load-tutor-dashboard";
import { useEffect, useState, useTransition } from "react";
import { secondaryButtonClass } from "./ui";

type AdminCohortLessonPanelProps = {
  cohortId: string;
  cohortName: string;
  onClose: () => void;
};

export function AdminCohortLessonPanel({
  cohortId,
  cohortName,
  onClose,
}: AdminCohortLessonPanelProps) {
  const [lessons, setLessons] = useState<TutorLessonRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      setLoadError(null);
      const data = await loadAdminCohortLessons(cohortId);
      if (data.error) {
        setLoadError(data.error);
        setLessons([]);
        return;
      }
      setLessons(data.lessons);
    });
  }

  useEffect(() => {
    reload();
  }, [cohortId]);

  if (pending && lessons.length === 0 && !loadError) {
    return <p className="mt-4 text-sm text-zinc-500">Loading lessons…</p>;
  }

  if (loadError) {
    return (
      <div className="mt-4">
        <p className="text-sm text-red-600">{loadError}</p>
        <button type="button" onClick={reload} className={`mt-2 ${secondaryButtonClass}`}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-zinc-100 pt-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">
          Lessons & recordings — {cohortName}
        </p>
        <button type="button" onClick={onClose} className={secondaryButtonClass}>
          Close
        </button>
      </div>
      <p className="mb-4 text-xs text-zinc-500">
        Unlock a lesson for everyone in this cohort, then paste the session recording link
        (YouTube, Loom, Zoom, etc.). Students see the recording on Learn once the lesson is
        unlocked.
      </p>
      <TutorLessonManager
        lessons={lessons}
        scope={{ mode: "admin-cohort", cohortId }}
        scopeLabel={`everyone in ${cohortName}`}
        onChanged={reload}
      />
    </div>
  );
}
