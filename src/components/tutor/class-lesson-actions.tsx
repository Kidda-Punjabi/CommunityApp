"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCohortLessonUnlock, setStudentLessonUnlock } from "@/app/dashboard/tutor/actions";
import { saveClassRecordingAction, unlockKidLessonEarlyAction } from "@/app/dashboard/tutor/classes/actions";

export function RecordingSaveField({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveClassRecordingAction(entryId, url);
          if (result.error) {
            setError(result.error);
            return;
          }
          setUrl("");
          router.refresh();
        });
      }}
    >
      <input
        type="url"
        inputMode="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Recording link"
        className="min-h-11 w-full rounded-full border border-red-200 bg-white px-4 text-sm text-zinc-900"
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving" : "Save"}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}

export function UnlockEarlyButton({
  cohortId,
  packageInstanceId,
  courseId,
  lessonId,
  studentId,
  kidProfileId,
}: {
  cohortId?: string;
  packageInstanceId?: string;
  courseId?: string;
  lessonId: string;
  studentId?: string | null;
  kidProfileId?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        className="min-h-11 rounded-full border border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 disabled:opacity-60"
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = cohortId
              ? await setCohortLessonUnlock(cohortId, lessonId, true)
              : kidProfileId && packageInstanceId
                ? await unlockKidLessonEarlyAction(packageInstanceId, kidProfileId, lessonId)
                : studentId && courseId
                  ? await setStudentLessonUnlock(studentId, courseId, lessonId, true)
                  : { error: "This lesson cannot be unlocked from here." };
            if (result.error) {
              setError(result.error);
              return;
            }
            router.refresh();
          });
        }}
      >
        {pending ? "Unlocking" : "Unlock early"}
      </button>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
