"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getAdminHomeworkNearLessonWarning,
  getAdminHomeworkPlaybackUrl,
  getAdminHomeworkTextNearLessonWarning,
  loadHomeworkTestBootstrapAction,
  loadHomeworkTestCohortsAction,
  loadHomeworkTestLessonsAction,
  loadHomeworkTestPreviewAction,
  loadHomeworkTestStudentsAction,
  submitAdminHomeworkRecording,
  submitAdminHomeworkText,
} from "@/app/admin/homework-test/actions";
import { HomeworkSubmissionSection } from "@/components/homework/homework-submission-section";
import { HomeworkTextForm } from "@/components/homework/homework-text-form";
import {
  filterHomeworkTestStudents,
  homeworkTestLessonLabel,
  pickDefaultHomeworkTestCourseId,
  type HomeworkTestCohort,
  type HomeworkTestCourse,
  type HomeworkTestLesson,
  type HomeworkTestPreview,
  type HomeworkTestStudent,
} from "@/lib/admin/homework-test-types";
import { ui } from "@/lib/ui/styles";

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900";

export function AdminHomeworkTestSection() {
  const [courses, setCourses] = useState<HomeworkTestCourse[]>([]);
  const [lessons, setLessons] = useState<HomeworkTestLesson[]>([]);
  const [cohorts, setCohorts] = useState<HomeworkTestCohort[]>([]);
  const [students, setStudents] = useState<HomeworkTestStudent[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [studentKey, setStudentKey] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [preview, setPreview] = useState<HomeworkTestPreview | null>(null);
  const [confirmedLive, setConfirmedLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pipelineNote, setPipelineNote] = useState<string | null>(null);

  const selectedLesson = lessons.find((row) => row.id === lessonId) ?? null;
  const selectedCohort = cohorts.find((row) => row.id === cohortId) ?? null;
  const selectedStudent = students.find((row) => row.key === studentKey) ?? null;
  const visibleStudents = useMemo(
    () => filterHomeworkTestStudents(students, studentQuery),
    [students, studentQuery]
  );

  useEffect(() => {
    let cancelled = false;
    void loadHomeworkTestBootstrapAction().then((result) => {
      if (cancelled) return;
      setCourses(result.courses);
      setLoadError(result.error ?? null);
      setCourseId(pickDefaultHomeworkTestCourseId(result.courses));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!courseId) {
      setLessons([]);
      setCohorts([]);
      setLessonId("");
      setCohortId("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void Promise.all([
      loadHomeworkTestLessonsAction(courseId),
      loadHomeworkTestCohortsAction(courseId),
    ]).then(([lessonResult, cohortResult]) => {
      if (cancelled) return;
      setLessons(lessonResult.lessons);
      setCohorts(cohortResult.cohorts);
      setLessonId("");
      setCohortId("");
      setStudentKey("");
      setStudents([]);
      setPreview(null);
      setConfirmedLive(false);
      setLoadError(lessonResult.error ?? cohortResult.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!cohortId) {
      setStudents([]);
      setStudentKey("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void loadHomeworkTestStudentsAction(cohortId).then((result) => {
      if (cancelled) return;
      setStudents(result.students);
      setStudentKey("");
      setPreview(null);
      setConfirmedLive(false);
      setLoadError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cohortId]);

  useEffect(() => {
    if (!lessonId || !cohortId || !studentKey) {
      setPreview(null);
      setConfirmedLive(false);
      return;
    }

    let cancelled = false;
    setPreview(null);
    setConfirmedLive(false);
    setLoading(true);
    void loadHomeworkTestPreviewAction(lessonId, cohortId, studentKey).then((result) => {
      if (cancelled) return;
      setPreview(result.preview ?? null);
      setConfirmedLive(Boolean(result.preview?.submission));
      setLoadError(result.error ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [cohortId, lessonId, studentKey]);

  async function reloadPreview() {
    if (!lessonId || !cohortId || !studentKey) return;
    const result = await loadHomeworkTestPreviewAction(lessonId, cohortId, studentKey);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setPreview(result.preview ?? null);
  }

  const actorInput = selectedStudent
    ? { lessonId, cohortId, studentKey: selectedStudent.key }
    : null;

  const alreadySubmitted = Boolean(preview?.submission);
  const canRenderHomework =
    preview && selectedStudent && actorInput && (alreadySubmitted || confirmedLive);

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin/cohorts-hub" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Cohorts
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
          Test homework submission
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Submit as a real student for a cohort/package, using the live homework UI. This writes
          a real <code className="text-xs">homework_submissions</code> row so the tutor inbox and
          audio pipeline can be verified.
        </p>
      </div>

      {loadError ? <p className="mb-4 text-sm text-red-600">{loadError}</p> : null}

      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">1. Course</span>
          <select
            className={selectClass}
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          >
            <option value="">Select a course…</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">2. Week / lesson</span>
          <select
            className={selectClass}
            value={lessonId}
            disabled={!courseId}
            onChange={(event) => {
              setLessonId(event.target.value);
              setConfirmedLive(false);
              setPipelineNote(null);
            }}
          >
            <option value="">Select a homework lesson…</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {homeworkTestLessonLabel(lesson)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">3. Cohort</span>
          <select
            className={selectClass}
            value={cohortId}
            disabled={!courseId}
            onChange={(event) => setCohortId(event.target.value)}
          >
            <option value="">Select a cohort…</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
                {cohort.tutorLabel ? ` · ${cohort.tutorLabel}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div>
          <label className="block" htmlFor="homework-test-student-search">
            <span className="text-sm font-medium text-zinc-700">4. Student / package</span>
          </label>
          <input
            id="homework-test-student-search"
            type="search"
            value={studentQuery}
            disabled={!cohortId}
            onChange={(event) => setStudentQuery(event.target.value)}
            placeholder="Search by name…"
            className={selectClass}
            autoComplete="off"
          />
          <select
            className={selectClass}
            value={studentKey}
            disabled={!cohortId}
            onChange={(event) => {
              setStudentKey(event.target.value);
              setPipelineNote(null);
            }}
          >
            <option value="">Select a student…</option>
            {visibleStudents.map((student) => (
              <option key={student.key} value={student.key}>
                {student.displayName}
                {student.packageLabel ? ` · ${student.packageLabel}` : ""}
              </option>
            ))}
          </select>
          {cohortId && !loading && visibleStudents.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-500">No matching students in this cohort.</p>
          ) : null}
        </div>
      </div>

      {loading ? <p className="mt-4 text-sm text-zinc-500">Loading…</p> : null}

      {preview && selectedStudent && selectedLesson && selectedCohort ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Live submission</p>
            <p className="mt-1">
              This uses the same insert path as a student. It sets{" "}
              <code className="text-xs">is_practice = false</code> so the row appears in{" "}
              {selectedCohort.tutorLabel
                ? `${selectedCohort.tutorLabel}'s`
                : "the tutor"}{" "}
              homework inbox. Practice rows are excluded from that queue.
            </p>
            {alreadySubmitted ? (
              <p className="mt-2">
                {selectedStudent.displayName} already has a formal submission for this lesson.
                The live UI below shows that existing row.
              </p>
            ) : (
              <p className="mt-2">
                If {selectedStudent.displayName} has not submitted this week yet, this will block
                their own later submission (one formal homework per lesson).
              </p>
            )}
          </div>

          {!alreadySubmitted ? (
            <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmedLive}
                onChange={(event) => setConfirmedLive(event.target.checked)}
              />
              <span>
                I understand this creates a real homework submission for{" "}
                <strong>{selectedStudent.displayName}</strong> ({selectedLesson.title}) and will
                show in the tutor inbox.
              </span>
            </label>
          ) : null}

          {pipelineNote ? (
            <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              {pipelineNote}
            </p>
          ) : null}

          {canRenderHomework && actorInput ? (
            <div className="rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]">
              <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
                Lesson {preview.lesson.lessonNumber} · {selectedCohort.name}
              </p>
              <h2 className="mt-1 text-xl font-bold text-zinc-900">Homework</h2>
              <p className="mt-2 text-sm text-zinc-600">{preview.lesson.title}</p>
              <p className="mt-3 text-base text-zinc-800">{preview.taskDescription}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Submitting as {selectedStudent.displayName}
                {selectedStudent.studentPackageId
                  ? ` · package ${selectedStudent.studentPackageId.slice(0, 8)}`
                  : ""}
                {selectedStudent.studentId
                  ? ` · student ${selectedStudent.studentId.slice(0, 8)}`
                  : ""}
              </p>

              {preview.lesson.submissionType === "text" ? (
                <div className="mt-6">
                  <HomeworkTextForm
                    key={`${preview.lesson.id}-${selectedStudent.key}-text`}
                    lessonId={preview.lesson.id}
                    questions={preview.questions}
                    existingSubmission={preview.submission}
                    submitText={async (id, answers) => {
                      const result = await submitAdminHomeworkText(
                        { ...actorInput, lessonId: id },
                        answers
                      );
                      if (!result.error) {
                        setPipelineNote(
                          result.submissionId
                            ? `Submitted. Row ${result.submissionId} should appear at /dashboard/tutor/homework.`
                            : result.success ?? "Submitted."
                        );
                        await reloadPreview();
                      }
                      return result;
                    }}
                    loadNearLessonWarning={(id) =>
                      getAdminHomeworkTextNearLessonWarning(
                        id,
                        selectedStudent.studentId,
                        selectedStudent.kidProfileId
                      )
                    }
                  />
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-zinc-200/80 bg-white/95 p-4">
                  <p className="text-sm font-semibold text-zinc-900">
                    {preview.submission ? "Your homework" : "Record homework"}
                  </p>
                  <HomeworkSubmissionSection
                    key={`${preview.lesson.id}-${selectedStudent.key}-voice`}
                    lessonId={preview.lesson.id}
                    submission={preview.submission}
                    variant="embedded"
                    submitRecording={async (id, formData) => {
                      const result = await submitAdminHomeworkRecording(
                        { ...actorInput, lessonId: id },
                        formData
                      );
                      if (!result.error) {
                        setPipelineNote(
                          [
                            result.success,
                            result.submissionId ? `Row ${result.submissionId}.` : null,
                            result.storagePath ? `Audio ${result.storagePath}.` : null,
                            "Check /dashboard/tutor/homework for the tutor inbox.",
                          ]
                            .filter(Boolean)
                            .join(" ")
                        );
                        await reloadPreview();
                      }
                      return result;
                    }}
                    loadPlaybackUrl={getAdminHomeworkPlaybackUrl}
                    loadNearLessonWarning={(id) =>
                      getAdminHomeworkNearLessonWarning(
                        id,
                        selectedStudent.studentId,
                        selectedStudent.kidProfileId
                      )
                    }
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
