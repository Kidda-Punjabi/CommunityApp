"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createPackageRun,
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
import { ui } from "@/lib/ui/styles";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
};

export function PackageRunFormModal({ mode, initial, onClose, onSaved }: PackageRunFormModalProps) {
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
  const [startDate, setStartDate] = useState(initial?.startDate?.slice(0, 10) ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate?.slice(0, 10) ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

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
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
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

      const fieldsResult = await updatePackageRunFields(initial.kind, initial.id, {
        name,
        tutorId: tutorId || null,
        startDayOfWeek: startDay || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">
              {mode === "create" ? "New package" : "Edit package"}
            </h3>
            <p className="text-sm text-zinc-500">
              {mode === "create"
                ? "Create a group cohort or 1-1 / small-group run."
                : "Update schedule, tutor, and status."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ×
          </button>
        </div>

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
                  onChange={(e) => setStartDate(e.target.value)}
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

            {mode === "edit" && (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Active (uncheck to archive)
              </label>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={pending || !name.trim()}
                className={ui.btnPrimary}
              >
                {mode === "create" ? "Create package" : "Save changes"}
              </button>
              <button type="button" onClick={onClose} className={ui.btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
