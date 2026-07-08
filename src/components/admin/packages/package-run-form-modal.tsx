"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createPackageRun,
  deletePackageRun,
  fetchPackageFormOptions,
  updatePackageInstanceStatus,
  updatePackageRunFields,
} from "@/app/admin/packages/actions";
import type { AdminPackageKind, AdminPackageListRow } from "@/lib/admin/packages/types";
import {
  PACKAGE_INSTANCE_STATUSES,
  packageStatusLabel,
  type PackageInstanceStatus,
} from "@/lib/admin/package-status";
import {
  dateInputFromIso,
  isoFromDateInput,
  PACKAGE_WEEKDAYS,
  weekdayFromDateInput,
} from "@/lib/admin/package-schedule";
import { ui } from "@/lib/ui/styles";

const WEEKDAYS = [...PACKAGE_WEEKDAYS];

type CatalogPackage = {
  id: string;
  name: string;
  courseId: string;
  deliveryMode: string | null;
};

type CourseOption = { id: string; name: string; tier: string | null };

type TutorOption = { id: string; name: string };

type PackageRunFormModalProps = {
  mode: "create" | "edit";
  initial?: AdminPackageListRow;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
};

export function PackageRunFormModal({
  mode,
  initial,
  onClose,
  onSaved,
  onDeleted,
}: PackageRunFormModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [catalogPackages, setCatalogPackages] = useState<CatalogPackage[]>([]);
  const [tutors, setTutors] = useState<TutorOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [kind, setKind] = useState<AdminPackageKind>(initial?.kind ?? "cohort");
  const [name, setName] = useState(initial?.name ?? "");
  const [courseId, setCourseId] = useState(initial?.courseId ?? "");
  const [packageId, setPackageId] = useState(initial?.packageId ?? "");
  const [tutorId, setTutorId] = useState(initial?.tutorId ?? "");
  const [status, setStatus] = useState<PackageInstanceStatus>(
    initial?.status ?? "pre_scheduling"
  );
  const [capacity, setCapacity] = useState(String(initial?.capacity ?? (kind === "cohort" ? 7 : 1)));
  const [startDay, setStartDay] = useState(initial?.startDayOfWeek ?? "");
  const [startDate, setStartDate] = useState(dateInputFromIso(initial?.startDate));
  const [endDate, setEndDate] = useState(dateInputFromIso(initial?.endDate));
  const [active, setActive] = useState(initial?.active ?? true);

  const isCommunity = initial?.kind === "community";

  function handleStartDateChange(value: string) {
    setStartDate(value);
    if (!value || startDay) return;
    const weekday = weekdayFromDateInput(value);
    if (weekday) setStartDay(weekday);
  }

  useEffect(() => {
    fetchPackageFormOptions().then((result) => {
      setCourses(result.courses);
      setCatalogPackages(result.packages);
      setTutors(result.tutors);
      setLoadingOptions(false);
      if (mode === "create" && !courseId && result.courses.length > 0) {
        const beginners = result.courses.find((c) => c.tier === "beginners");
        if (beginners) setCourseId(beginners.id);
      }
      if (mode === "create" && kind === "package_instance" && !packageId) {
        const first = result.packages.find((p) => p.deliveryMode !== "group");
        if (first) {
          setPackageId(first.id);
          setCourseId(first.courseId);
        }
      }
    });
  }, [mode, kind, courseId, packageId]);

  const groupPackages = catalogPackages.filter((p) => p.deliveryMode === "group");
  const instancePackages = catalogPackages.filter((p) => p.deliveryMode !== "group");

  function handleKindChange(next: AdminPackageKind) {
    setKind(next);
    setCapacity(next === "cohort" ? "7" : "1");
    if (next === "cohort") {
      const beginners = courses.find((c) => c.tier === "beginners");
      if (beginners) setCourseId(beginners.id);
      setPackageId("");
    } else {
      const first = instancePackages[0];
      if (first) {
        setPackageId(first.id);
        setCourseId(first.courseId);
      }
    }
  }

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);
    const pkg = catalogPackages.find((p) => p.id === nextPackageId);
    if (pkg) setCourseId(pkg.courseId);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      if (mode === "create") {
        const result = await createPackageRun({
          kind,
          name,
          courseId: kind === "cohort" ? courseId : undefined,
          packageId: kind === "package_instance" ? packageId : undefined,
          tutorId: tutorId || null,
          status,
          capacity: Number(capacity) || (kind === "cohort" ? 7 : 1),
          startDayOfWeek: startDay || null,
          startDate: isoFromDateInput(startDate),
          endDate: isoFromDateInput(endDate),
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        onSaved();
        onClose();
        if (result.id) router.push(`/admin/packages/${result.id}`);
        return;
      }

      if (!initial) return;

      if (initial.kind === "community") {
        const fieldsResult = await updatePackageRunFields(initial.kind, initial.id, {
          name,
          active,
        });
        if (fieldsResult.error) {
          setError(fieldsResult.error);
          return;
        }
        onSaved();
        onClose();
        router.refresh();
        return;
      }

      const fieldsResult = await updatePackageRunFields(initial.kind, initial.id, {
        name,
        tutorId: tutorId || null,
        startDayOfWeek: startDay || null,
        startDate: isoFromDateInput(startDate),
        endDate: isoFromDateInput(endDate),
        capacity: Number(capacity) || initial.capacity,
        active,
      });
      if (fieldsResult.error) {
        setError(fieldsResult.error);
        return;
      }

      if (status !== initial.status) {
        const statusResult = await updatePackageInstanceStatus(initial.kind, initial.id, status);
        if (statusResult.error) {
          setError(statusResult.error);
          return;
        }
      }

      onSaved();
      onClose();
      router.refresh();
    });
  }

  function handleDelete() {
    if (!initial || initial.kind === "community") return;
    const label = initial.name.trim() || "this package";
    if (
      !window.confirm(
        `Delete ${label}? Students will be unassigned from this run. This cannot be undone.`
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deletePackageRun(initial.kind, initial.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      onDeleted?.();
      onSaved();
      onClose();
      router.push("/admin/packages");
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px)+1rem)] sm:items-center sm:py-8 sm:pb-8">
      <div
        className="flex min-h-0 max-h-[min(90dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="package-run-modal-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-100 px-6 py-4">
          <div>
            <h3 id="package-run-modal-title" className="text-lg font-semibold text-zinc-900">
              {mode === "create" ? "New package" : "Edit package"}
            </h3>
            <p className="text-sm text-zinc-500">
              {mode === "create"
                ? "Create a group cohort or 1-1 / small-group run."
                : isCommunity
                  ? "Update the community package name and visibility."
                  : "Update schedule, tutor, and status."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 pb-6">
          {loadingOptions ? (
            <p className="text-sm text-zinc-500">Loading options…</p>
          ) : (
            <div className="space-y-4">
              {mode === "create" && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleKindChange("cohort")}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                      kind === "cohort"
                        ? "border-violet-300 bg-violet-50 text-violet-800"
                        : "border-zinc-200 text-zinc-700"
                    }`}
                  >
                    Group cohort
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKindChange("package_instance")}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold ${
                      kind === "package_instance"
                        ? "border-violet-300 bg-violet-50 text-violet-800"
                        : "border-zinc-200 text-zinc-700"
                    }`}
                  >
                    1-1 / small-group
                  </button>
                </div>
              )}

              <label className="block text-sm text-zinc-700">
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={kind === "cohort" ? "Cohort 41" : "Sarah — Foundational"}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                />
              </label>

              {isCommunity ? (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active
                </label>
              ) : (
                <>
              {mode === "create" && kind === "cohort" && (
                <label className="block text-sm text-zinc-700">
                  Course
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  >
                    <option value="">Select course</option>
                    {courses
                      .filter((c) => groupPackages.some((p) => p.courseId === c.id))
                      .map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {mode === "create" && kind === "package_instance" && (
                <label className="block text-sm text-zinc-700">
                  Package product
                  <select
                    value={packageId}
                    onChange={(e) => handlePackageChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  >
                    <option value="">Select package</option>
                    {instancePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {mode === "edit" && initial && (
                <p className="text-sm text-zinc-500">
                  {initial.courseName}
                  {initial.deliveryMode === "group" ? " · Group cohort" : " · 1-1 instance"}
                </p>
              )}

              <label className="block text-sm text-zinc-700">
                Tutor
                <select
                  value={tutorId}
                  onChange={(e) => setTutorId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm text-zinc-700">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as PackageInstanceStatus)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                >
                  {PACKAGE_INSTANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {packageStatusLabel(s)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-zinc-700">
                  Capacity
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm text-zinc-700">
                  Start day
                  <select
                    value={startDay}
                    onChange={(e) => setStartDay(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  >
                    <option value="">—</option>
                    {WEEKDAYS.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-zinc-700">
                  Start date
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm text-zinc-700">
                  End date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2"
                  />
                </label>
              </div>

              {mode === "edit" && !isCommunity && (
                <label className="flex items-center gap-2 text-sm text-zinc-700">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Active (uncheck to archive)
                </label>
              )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            {mode === "edit" && initial && !isCommunity && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={pending}
                className="text-sm font-semibold text-red-600 hover:text-red-500 disabled:opacity-50"
              >
                Delete package
              </button>
            )}
            <div className="ml-auto flex flex-wrap gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={pending || !name.trim() || (loadingOptions && !isCommunity)}
                className={ui.btnPrimary}
              >
                {mode === "create" ? "Create package" : "Save changes"}
              </button>
              <button type="button" onClick={onClose} className={ui.btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
