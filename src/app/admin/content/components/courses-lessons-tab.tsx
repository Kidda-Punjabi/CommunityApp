"use client";

import { AudioPanel } from "@/app/admin/content/components/audio-panel";
import { appendAdminUploadedFileUrl } from "@/lib/supabase/admin-upload";
import {
  lessonAudioStatusBadgeClass,
  LESSON_AUDIO_STATUS_LABELS,
  type LessonAudioStatus,
} from "@/lib/audio/types";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createLesson,
  deleteLesson,
  ensureStorageBucketsAction,
  updateLesson,
  type ActionResult,
} from "../actions";
import type { AdminData } from "../types";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initialState: ActionResult = {};

function lessonAudioStatus(lesson: AdminData["lessons"][0]): LessonAudioStatus {
  return lesson.generated_audio_status ?? "none";
}

function contentTags(lesson: AdminData["lessons"][0]): string[] {
  const tags: string[] = [];
  if (lesson.presentation_url) tags.push("Presentation");
  if (lesson.pdf_url) tags.push("PDF");
  const status = lessonAudioStatus(lesson);
  if (status === "approved" && lesson.audio_url) {
    tags.push("Audio");
  } else if (status !== "none") {
    tags.push(`Audio (${LESSON_AUDIO_STATUS_LABELS[status]})`);
  }
  return tags;
}

function filenameFromStorageUrl(url: string | null | undefined) {
  if (!url) return null;
  try {
    const segment = url.split("/").pop()?.split("?")[0] ?? "";
    return decodeURIComponent(segment) || null;
  } catch {
    return null;
  }
}

export function CoursesLessonsTab({ data }: { data: AdminData }) {
  const [createState, createAction, createPending] = useActionState(
    createLesson,
    initialState
  );
  const [createUploading, setCreateUploading] = useState(false);
  const [createUploadError, setCreateUploadError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateUploadError("");
    setCreateUploading(true);

    const formData = new FormData(event.currentTarget);

    try {
      await appendAdminUploadedFileUrl(formData, "pdf", "lesson-pdfs", "pdf_url");
      await appendAdminUploadedFileUrl(formData, "audio", "audio-files", "audio_url");
      createAction(formData);
    } catch (error) {
      setCreateUploadError(
        error instanceof Error ? error.message : "File upload failed."
      );
    } finally {
      setCreateUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {data.courses.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No courses are loaded. Add rows in the `courses` table first, or check the
          fetch error banner above.
        </p>
      )}
      <SectionCard title="Add lesson">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Course</label>
              <select name="course_id" required className={inputClass}>
                <option value="">Select course</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Lesson number</label>
              <input
                name="lesson_number"
                type="number"
                min={1}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input name="title" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Access</label>
            <select name="is_free" className={inputClass}>
              <option value="true">Free</option>
              <option value="false">Paid</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Presentation link</label>
            <input
              name="presentation_url"
              type="url"
              placeholder="https://docs.google.com/presentation/..."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Google Slides, Canva, or any shareable presentation URL.
            </p>
          </div>
          <div>
            <label className={labelClass}>Audio script (optional)</label>
            <textarea
              name="audio_script"
              rows={3}
              dir="auto"
              className={inputClass}
              placeholder="Punjabi text for ElevenLabs — generate after saving the lesson"
            />
          </div>
          <details className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600">
              Legacy PDF / audio (optional)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className={labelClass}>Lesson PDF</label>
                <input
                  name="pdf"
                  type="file"
                  accept="application/pdf"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Audio file</label>
                <input
                  name="audio"
                  type="file"
                  accept="audio/*"
                  className={inputClass}
                />
              </div>
            </div>
          </details>
          <FormMessage state={createState} />
          {createUploadError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {createUploadError}
            </p>
          )}
          <button
            type="submit"
            disabled={createPending || createUploading}
            className={buttonClass}
          >
            {createUploading
              ? "Uploading files…"
              : createPending
                ? "Saving…"
                : "Add lesson"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Lessons (${data.lessons.length})`}>
        {data.lessons.length === 0 ? (
          <p className="text-sm text-zinc-500">No lessons yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.lessons.map((lesson) =>
              editingId === lesson.id ? (
                <LessonEditRow
                  key={lesson.id}
                  lesson={lesson}
                  courses={data.courses}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <li
                  key={lesson.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {lesson.courses?.name} · Lesson {lesson.lesson_number}:{" "}
                      {lesson.title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {lesson.is_free ? "Free" : "Paid"}
                      {contentTags(lesson).length > 0 ? (
                        <>
                          {" · "}
                          {contentTags(lesson).join(" · ")}
                        </>
                      ) : null}
                      {lesson.presentation_url ? (
                        <>
                          {" · "}
                          <a
                            href={lesson.presentation_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-violet-600 hover:underline"
                          >
                            Open presentation
                          </a>
                        </>
                      ) : null}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${lessonAudioStatusBadgeClass(lessonAudioStatus(lesson))}`}
                    >
                      Audio: {LESSON_AUDIO_STATUS_LABELS[lessonAudioStatus(lesson)]}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(lesson.id)}
                      className={secondaryButtonClass}
                    >
                      Edit
                    </button>
                    <DeleteLessonButton id={lesson.id} />
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function LessonEditRow({
  lesson,
  courses,
  onCancel,
  onSaved,
}: {
  lesson: AdminData["lessons"][0];
  courses: AdminData["courses"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateLesson, initialState);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const currentPdfName = filenameFromStorageUrl(lesson.pdf_url);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    setUploading(true);

    const formData = new FormData(event.currentTarget);

    try {
      await appendAdminUploadedFileUrl(formData, "pdf", "lesson-pdfs", "pdf_url");
      await appendAdminUploadedFileUrl(formData, "audio", "audio-files", "audio_url");
      action(formData);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "File upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <li className="py-4">
      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-zinc-50 p-4">
        <input type="hidden" name="id" value={lesson.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Course</label>
            <select
              name="course_id"
              defaultValue={lesson.course_id}
              className={inputClass}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Lesson number</label>
            <input
              name="lesson_number"
              type="number"
              defaultValue={lesson.lesson_number}
              className={inputClass}
            />
          </div>
        </div>
        <input name="title" defaultValue={lesson.title} className={inputClass} />
        <select
          name="is_free"
          defaultValue={lesson.is_free ? "true" : "false"}
          className={inputClass}
        >
          <option value="true">Free</option>
          <option value="false">Paid</option>
        </select>
        <input
          name="presentation_url"
          type="url"
          defaultValue={lesson.presentation_url ?? ""}
          placeholder="https://docs.google.com/presentation/..."
          className={inputClass}
        />
        <AudioPanel
          contentType="lesson"
          contentId={lesson.id}
          defaultScript={lesson.audio_script ?? ""}
        />
        <details className="rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-zinc-600">
            Legacy PDF / audio (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass}>Replace PDF</label>
              {currentPdfName && (
                <p className="mb-2 text-sm text-zinc-600">
                  Current file:{" "}
                  <a
                    href={lesson.pdf_url ?? "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-violet-600 hover:underline"
                  >
                    {currentPdfName}
                  </a>
                </p>
              )}
              <input name="pdf" type="file" accept="application/pdf" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Replace audio</label>
              <input name="audio" type="file" accept="audio/*" className={inputClass} />
            </div>
          </div>
        </details>
        <FormMessage state={state} />
        {uploadError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {uploadError}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={pending || uploading} className={buttonClass}>
            {uploading ? "Uploading…" : pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function DeleteLessonButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this lesson?")) return;
        setPending(true);
        await deleteLesson(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
