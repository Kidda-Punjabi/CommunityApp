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
  loadHomeworkTestLessonViewAction,
  loadHomeworkTestPreviewAction,
  loadHomeworkTestStudentsAction,
  submitAdminHomeworkRecording,
  submitAdminHomeworkText,
} from "@/app/admin/homework-test/actions";
import { HomeworkSubmissionSection } from "@/components/homework/homework-submission-section";
import { HomeworkTextForm } from "@/components/homework/homework-text-form";
import {
  filterHomeworkTestStudents,
  homeworkTestFormatLabel,
  homeworkTestLessonLabel,
  pickDefaultHomeworkTestCourseId,
  type HomeworkTestCohort,
  type HomeworkTestCourse,
  type HomeworkTestLesson,
  type HomeworkTestLessonView,
  type HomeworkTestPreview,
  type HomeworkTestStudent,
} from "@/lib/admin/homework-test-types";
import { ui } from "@/lib/ui/styles";

const selectClass =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900";

const PICK_STUDENT_FIRST =
  "Choose a student below and confirm the live submission before submitting.";

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
  const [lessonView, setLessonView] = useState<HomeworkTestLessonView | null>(null);
  const [preview, setPreview] = useState<HomeworkTestPreview | null>(null);
  const [confirmedLive, setConfirmedLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingLesson, setLoadingLesson] = useState(false);
  const [pipelineNote, setPipelineNote] = useState<string | null>(null);

  const selectedLesson = lessons.find((row) => row.id === lessonId) ?? null;
  const selectedCohort = cohorts.find((row) => row.id === cohortId) ?? null;
  const selectedStudent = students.find((row) => row.key === studentKey) ?? null;
  const visibleStudents = useMemo(
    () => filterHomeworkTestStudents(students, studentQuery),
    [students, studentQuery]
  );
  const viewLesson = lessonView?.lesson ?? selectedLesson;
  const alreadySubmitted = Boolean(preview?.submission);
  const canSubmitLive = Boolean(selectedStudent && confirmedLive && !alreadySubmitted);
  const actorInput = selectedStudent
    ? { lessonId, cohortId, studentKey: selectedStudent.key }
    : null;

  useEffect(() => {
    let cancelled = false;
    void loadHomeworkTestBootstrapAction().then((result) => {
      if (cancelled) return;
      setCourses(result.courses);
      setLoadError(result.error ?? null);
      setCourseId(pickDefaultHomeworkTestCourseId(result.courses));
      setLoadingOptions(false);
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
    setLoadingOptions(true);
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
      setLessonView(null);
      setPreview(null);
      setConfirmedLive(false);
      setLoadError(lessonResult.error ?? cohortResult.error ?? null);
      setLoadingOptions(false);
    });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (!lessonId) {
      setLessonView(null);
      return;
    }

    let cancelled = false;
    setLessonView(null);
    setLoadingLesson(true);
    void loadHomeworkTestLessonViewAction(lessonId).then((result) => {
      if (cancelled) return;
      setLessonView(result.view ?? null);
      setLoadError(result.error ?? null);
      setLoadingLesson(false);
    });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  useEffect(() => {
    if (!cohortId) {
      setStudents([]);
      setStudentKey("");
      return;
    }

    let cancelled = false;
    void loadHomeworkTestStudentsAction(cohortId).then((result) => {
      if (cancelled) return;
      setStudents(result.students);
      setStudentKey("");
      setPreview(null);
      setConfirmedLive(false);
      setLoadError(result.error ?? null);
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
    void loadHomeworkTestPreviewAction(lessonId, cohortId, studentKey).then((result) => {
      if (cancelled) return;
      setPreview(result.preview ?? null);
      setConfirmedLive(Boolean(result.preview?.submission));
      setLoadError(result.error ?? null);
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

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link href="/admin/content-hub" className="text-sm font-medium text-violet-600 hover:text-violet-500">
          ← Content
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">
          Test homework submission
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a course and week to see the live student homework page — the task, format, and
          record / write UI. Choose a student only if you want to submit for real.
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
          <span className="text-sm font-medium text-zinc-700">3. Cohort (only to submit)</span>
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
            <span className="text-sm font-medium text-zinc-700">4. Student / package (only to submit)</span>
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
          {cohortId && visibleStudents.length === 0 ? (
            <p className="mt-1 text-xs text-zinc-500">No matching students in this cohort.</p>
          ) : null}
        </div>
      </div>

      {loadingOptions && !viewLesson ? (
        <p className="mt-4 text-sm text-zinc-500">Loading…</p>
      ) : null}

      {lessonId && loadingLesson && !lessonView ? (
        <p className="mt-4 text-sm text-zinc-500">Loading student homework page…</p>
      ) : null}

      {lessonView && viewLesson ? (
        <div className="mt-6 space-y-4">
          {selectedStudent && selectedCohort ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Live submission</p>
              <p className="mt-1">
                Submitting as {selectedStudent.displayName} writes a real row (
                <code className="text-xs">is_practice = false</code>) to{" "}
                {selectedCohort.tutorLabel
                  ? `${selectedCohort.tutorLabel}'s`
                  : "the tutor"}{" "}
                homework inbox.
              </p>
              {alreadySubmitted ? (
                <p className="mt-2">
                  {selectedStudent.displayName} already submitted this lesson. The student view
                  below still shows the assignment they were given.
                </p>
              ) : (
                <label className="mt-3 flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmedLive}
                    onChange={(event) => setConfirmedLive(event.target.checked)}
                  />
                  <span>
                    I understand this creates a real homework submission for{" "}
                    <strong>{selectedStudent.displayName}</strong>.
                  </span>
                </label>
              )}
            </div>
          ) : null}

          {pipelineNote ? (
            <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
              {pipelineNote}
            </p>
          ) : null}

          <div>
            <p className="text-sm font-semibold text-zinc-900">Student homework page</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              This is the same screen a student gets for this week, including the task and{" "}
              {homeworkTestFormatLabel(viewLesson.submissionType)} controls.
            </p>
            <div className="mx-auto mt-3 max-w-md overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-zinc-50 shadow-[0_8px_32px_-8px_rgba(24,24,27,0.18)]">
              <div className="px-5 py-7">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-600">
                  Lesson {viewLesson.lessonNumber} · {lessonView.courseName}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-zinc-900">Homework</h2>
                <p className="mt-2 text-sm text-zinc-600">{viewLesson.title}</p>
                <p className="mt-3 text-base text-zinc-800">{lessonView.taskDescription}</p>

                {viewLesson.submissionType === "text" ? (
                  <div className="mt-6">
                    <HomeworkTextForm
                      key={`${viewLesson.id}-text`}
                      lessonId={viewLesson.id}
                      questions={lessonView.questions}
                      existingSubmission={null}
                      submitText={async (id, answers) => {
                        if (!canSubmitLive || !actorInput) {
                          return { error: PICK_STUDENT_FIRST };
                        }
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
                        selectedStudent
                          ? getAdminHomeworkTextNearLessonWarning(
                              id,
                              selectedStudent.studentId,
                              selectedStudent.kidProfileId
                            )
                          : Promise.resolve({ nearLessonWarning: null, timingState: null })
                      }
                    />
                  </div>
                ) : (
                  <div className="sticky bottom-0 z-10 mt-6 rounded-3xl border border-zinc-200/80 bg-white/95 p-4 shadow-[0_8px_32px_-8px_rgba(24,24,27,0.18)] backdrop-blur">
                    <p className="text-sm font-semibold text-zinc-900">Record homework</p>
                    <HomeworkSubmissionSection
                      key={`${viewLesson.id}-voice`}
                      lessonId={viewLesson.id}
                      submission={null}
                      variant="embedded"
                      submitRecording={async (id, formData) => {
                        if (!canSubmitLive || !actorInput) {
                          return { error: PICK_STUDENT_FIRST };
                        }
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
                        selectedStudent
                          ? getAdminHomeworkNearLessonWarning(
                              id,
                              selectedStudent.studentId,
                              selectedStudent.kidProfileId
                            )
                          : Promise.resolve({ nearLessonWarning: null, timingState: null })
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
