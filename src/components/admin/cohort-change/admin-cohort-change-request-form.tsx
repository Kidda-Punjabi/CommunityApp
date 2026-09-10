"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createAdminCohortChangeRequest,
  fetchAdminCoursesForCohortChange,
  fetchStudentCourseEnrollments,
} from "@/app/admin/cohort-change-requests/actions";
import type { AdminMemberOption } from "@/app/admin/content/actions";
import { inputClass, labelClass } from "@/app/admin/content/components/ui";
import { AdminMemberSearch } from "@/components/admin/admin-member-search";
import {
  COHORT_CHANGE_FEE_STATUSES,
  type AdminCourseOption,
  type CohortChangeFeeStatus,
  type StudentCourseEnrollmentOption,
} from "@/lib/admin/cohort-change-request-types";
import { ui } from "@/lib/ui/styles";

export function AdminCohortChangeRequestForm() {
  const router = useRouter();
  const [courses, setCourses] = useState<AdminCourseOption[]>([]);
  const [enrollments, setEnrollments] = useState<StudentCourseEnrollmentOption[]>([]);
  const [student, setStudent] = useState<AdminMemberOption | null>(null);
  const [fromCourseId, setFromCourseId] = useState("");
  const [toCourseId, setToCourseId] = useState("");
  const [reason, setReason] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeStatus, setFeeStatus] = useState<CohortChangeFeeStatus>("unpaid");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void fetchAdminCoursesForCohortChange().then((result) => {
      setCourses(result.courses);
      setLoadError(result.error ?? null);
    });
  }, []);

  useEffect(() => {
    if (!student) {
      setEnrollments([]);
      setFromCourseId("");
      return;
    }

    void fetchStudentCourseEnrollments(student.userId).then((result) => {
      const next = result.enrollments;
      setEnrollments(next);
      if (result.error) setLoadError(result.error);
      if (next[0]) setFromCourseId(next[0].courseId);
    });
  }, [student]);

  const courseEnrollmentId =
    enrollments.find((row) => row.courseId === fromCourseId)?.id ?? null;

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await createAdminCohortChangeRequest({
        studentId: student?.userId ?? "",
        fromCourseId,
        toCourseId,
        courseEnrollmentId,
        reason,
        feeAmount: feeAmount.trim() === "" ? null : feeAmount,
        feeStatus,
      });
      if (result.error) {
        setMessage(result.error);
        return;
      }
      router.push(
        result.id ? `/admin/cohort-change-requests/${result.id}` : "/admin/cohort-change-requests"
      );
    });
  }

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <Link
          href="/admin/cohort-change-requests"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Cohort switch requests
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-zinc-900">Log a cohort switch</h1>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Admin-only paper trail. Saving this does not move the student between courses, create a
          Stripe charge, or notify the student.
        </p>
      </div>

      {loadError ? <p className="mb-4 text-sm text-red-600">{loadError}</p> : null}

      <form onSubmit={onSubmit} className={`${ui.cardBordered} max-w-xl space-y-4`}>
        <AdminMemberSearch selected={student} onSelect={setStudent} />

        {enrollments.length > 0 ? (
          <p className="text-xs text-zinc-500">
            Current enrollment
            {enrollments.length === 1 ? "" : "s"}:{" "}
            {enrollments.map((row) => row.courseName).join(", ")}. From-course is prefilled from
            the latest one.
          </p>
        ) : student ? (
          <p className="text-xs text-zinc-500">No course enrollment found for this student.</p>
        ) : null}

        <label className={labelClass}>
          From course
          <select
            required
            value={fromCourseId}
            onChange={(event) => setFromCourseId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select course…</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          To course
          <select
            required
            value={toCourseId}
            onChange={(event) => setToCourseId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select course…</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Why the student is moving course or level…"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </label>

        <label className={labelClass}>
          Fee amount (optional)
          <input
            type="number"
            min="0"
            step="0.01"
            value={feeAmount}
            onChange={(event) => setFeeAmount(event.target.value)}
            placeholder="Leave blank if none"
            className={inputClass}
          />
        </label>

        <label className={labelClass}>
          Fee status
          <select
            value={feeStatus}
            onChange={(event) => setFeeStatus(event.target.value as CohortChangeFeeStatus)}
            className={inputClass}
          >
            {COHORT_CHANGE_FEE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        {message ? <p className="text-sm text-red-600">{message}</p> : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" disabled={pending} className={ui.btnPrimary}>
            {pending ? "Saving…" : "Log request"}
          </button>
          <Link href="/admin/cohort-change-requests" className={ui.btnGhost}>
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
