"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { AnnouncementMemberPicker } from "./announcement-member-picker";
import type { AdminMemberOption } from "../actions";
import type { ActionResult } from "../actions";
import type { AdminData } from "../types";
import {
  addCohortMember,
  assignCourseEnrollment,
  createBeginnersCohort,
  removeCohortMemberForm,
  removeCourseEnrollmentForm,
  setUserAppRoles,
} from "../tutor-actions";
import {
  ASSIGNABLE_STAFF_ROLES,
  APP_ROLE_LABELS,
  type AppRole,
} from "@/lib/auth/admin-access";
import { hasAnyRole } from "@/lib/auth/profile-roles";
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

type StaffTutorsTabProps = {
  data: AdminData;
};

export function StaffTutorsTab({ data }: StaffTutorsTabProps) {
  const [roleMember, setRoleMember] = useState<AdminMemberOption[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [assignStudent, setAssignStudent] = useState<AdminMemberOption[]>([]);
  const [assignTutorId, setAssignTutorId] = useState("");
  const [assignCourseId, setAssignCourseId] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"" | "one_to_one" | "group">("");
  const [assignCohortId, setAssignCohortId] = useState("");
  const [cohortMemberPick, setCohortMemberPick] = useState<AdminMemberOption[]>([]);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortTutorId, setNewCohortTutorId] = useState("");

  const [roleState, roleAction, rolePending] = useActionState(setUserAppRoles, initialState);
  const [assignState, assignAction, assignPending] = useActionState(
    assignCourseEnrollment,
    initialState
  );
  const [cohortState, cohortAction, cohortPending] = useActionState(
    createBeginnersCohort,
    initialState
  );
  const [addMemberState, addMemberAction, addMemberPending] = useActionState(
    addCohortMember,
    initialState
  );

  useEffect(() => {
    const member = roleMember[0];
    if (!member) {
      setSelectedRoles([]);
      return;
    }
    const existing = (member.appRoles ?? []).filter((role): role is AppRole =>
      ASSIGNABLE_STAFF_ROLES.includes(role as AppRole)
    );
    setSelectedRoles(existing);
  }, [roleMember]);

  const tutorCourses = useMemo(
    () =>
      data.courses.filter((course) => {
        const tier = course.required_tier ?? "";
        return tier === "foundational" || tier === "beginners";
      }),
    [data.courses]
  );

  const beginnersCourse = tutorCourses.find((course) => course.required_tier === "beginners");
  const selectedCourse = tutorCourses.find((course) => course.id === assignCourseId);
  const selectedTier = selectedCourse?.required_tier ?? "";

  const assignableStaff = useMemo(
    () =>
      data.staffMembers.filter((member) =>
        hasAnyRole(member.appRoles as AppRole[], [...ASSIGNABLE_STAFF_ROLES])
      ),
    [data.staffMembers]
  );

  function toggleRole(role: AppRole) {
    setSelectedRoles((current) =>
      current.includes(role) ? current.filter((item) => item !== role) : [...current, role]
    );
  }

  function startEditStaff(member: AdminData["staffMembers"][number]) {
    setRoleMember([
      {
        userId: member.userId,
        email: member.email,
        displayName: member.displayName,
        avatarUrl: null,
        appRoles: member.appRoles,
      },
    ]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRoleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (roleMember.length === 0) return;

    const formData = new FormData();
    formData.set("user_id", roleMember[0].userId);
    for (const role of selectedRoles) {
      formData.append("app_roles", role);
    }
    roleAction(formData);
  }

  function handleAssignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (assignStudent.length === 0 || !assignTutorId || !assignCourseId) return;

    const formData = new FormData();
    formData.set("student_id", assignStudent[0].userId);
    formData.set("tutor_id", assignTutorId);
    formData.set("course_id", assignCourseId);
    if (selectedTier === "beginners" && deliveryMode) {
      formData.set("delivery_mode", deliveryMode);
    }
    if (deliveryMode === "group" && assignCohortId) {
      formData.set("cohort_id", assignCohortId);
    }
    assignAction(formData);
  }

  function handleCreateCohort(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!beginnersCourse || !newCohortName.trim()) return;
    const formData = new FormData();
    formData.set("course_id", beginnersCourse.id);
    formData.set("name", newCohortName.trim());
    if (newCohortTutorId) formData.set("tutor_id", newCohortTutorId);
    cohortAction(formData);
  }

  function handleAddCohortMember(cohortId: string) {
    if (cohortMemberPick.length === 0) return;
    const formData = new FormData();
    formData.set("cohort_id", cohortId);
    formData.set("user_id", cohortMemberPick[0].userId);
    addMemberAction(formData);
    setCohortMemberPick([]);
  }

  function roleBadges(roles: string[]) {
    if (roles.length === 0) {
      return (
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
          Member
        </span>
      );
    }

    return (
      <div className="flex flex-wrap justify-end gap-1">
        {roles.map((role) => (
          <span
            key={role}
            className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800"
          >
            {APP_ROLE_LABELS[role as AppRole] ?? role}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Assign staff roles">
        <p className="mb-4 text-sm text-zinc-600">
          Select one or more roles per person — e.g. tutor and community lead together. Leave all
          unchecked to remove staff access.
        </p>
        <form onSubmit={handleRoleSubmit} className="space-y-4">
          <AnnouncementMemberPicker selected={roleMember} onChange={setRoleMember} />
          <fieldset className="space-y-2">
            <legend className={labelClass}>Roles</legend>
            {ASSIGNABLE_STAFF_ROLES.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 hover:bg-violet-50"
              >
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm font-medium text-zinc-900">{APP_ROLE_LABELS[role]}</span>
              </label>
            ))}
          </fieldset>
          <FormMessage state={roleState} />
          <button
            type="submit"
            disabled={rolePending || roleMember.length === 0}
            className={buttonClass}
          >
            {rolePending ? "Saving…" : "Save roles"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Staff (${data.staffMembers.length})`}>
        {data.staffMembers.length === 0 ? (
          <p className="text-sm text-zinc-500">No staff roles assigned yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.staffMembers.map((member) => (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900">{member.displayName}</p>
                  {member.email && (
                    <p className="text-sm text-zinc-500">{member.email}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {roleBadges(member.appRoles)}
                  <button
                    type="button"
                    onClick={() => startEditStaff(member)}
                    className={secondaryButtonClass}
                  >
                    Edit roles
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Assign tutor to student">
        <p className="mb-4 text-sm text-zinc-600">
          You can assign a tutor before or after purchase. Foundational is always 1-1. Beginners
          requires a delivery mode; group also requires an active cohort membership.
        </p>
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div>
            <p className={labelClass}>Student</p>
            <AnnouncementMemberPicker selected={assignStudent} onChange={setAssignStudent} />
          </div>
          <div>
            <label htmlFor="assign_tutor" className={labelClass}>
              Tutor / staff
            </label>
            <select
              id="assign_tutor"
              value={assignTutorId}
              onChange={(event) => setAssignTutorId(event.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select staff member…</option>
              {assignableStaff.map((staff) => (
                <option key={staff.userId} value={staff.userId}>
                  {staff.displayName}
                  {staff.email ? ` (${staff.email})` : ""} —{" "}
                  {staff.appRoles
                    .map((role) => APP_ROLE_LABELS[role as AppRole] ?? role)
                    .join(", ")}
                </option>
              ))}
            </select>
            {assignableStaff.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Assign at least one staff role above first.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="assign_course" className={labelClass}>
              Course
            </label>
            <select
              id="assign_course"
              value={assignCourseId}
              onChange={(event) => {
                setAssignCourseId(event.target.value);
                setDeliveryMode("");
                setAssignCohortId("");
              }}
              className={inputClass}
              required
            >
              <option value="">Select course…</option>
              {tutorCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>

          {selectedTier === "beginners" && (
            <div>
              <label htmlFor="delivery_mode" className={labelClass}>
                Delivery mode
              </label>
              <select
                id="delivery_mode"
                value={deliveryMode}
                onChange={(event) => {
                  setDeliveryMode(event.target.value as "" | "one_to_one" | "group");
                  setAssignCohortId("");
                }}
                className={inputClass}
                required
              >
                <option value="">Select…</option>
                <option value="one_to_one">1-1 (tutor unlocks per student)</option>
                <option value="group">Group (cohort unlocks)</option>
              </select>
            </div>
          )}

          {selectedTier === "beginners" && deliveryMode === "group" && (
            <div>
              <label htmlFor="assign_cohort" className={labelClass}>
                Cohort
              </label>
              <select
                id="assign_cohort"
                value={assignCohortId}
                onChange={(event) => setAssignCohortId(event.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select cohort…</option>
                {data.cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name} ({cohort.members.length} members)
                  </option>
                ))}
              </select>
            </div>
          )}

          <FormMessage state={assignState} />
          <button
            type="submit"
            disabled={
              assignPending ||
              assignStudent.length === 0 ||
              !assignTutorId ||
              !assignCourseId
            }
            className={buttonClass}
          >
            {assignPending ? "Saving…" : "Assign tutor"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Enrollments (${data.enrollments.length})`}>
        {data.enrollments.length === 0 ? (
          <p className="text-sm text-zinc-500">No tutor assignments yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.enrollments.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm"
              >
                <p className="font-medium text-zinc-900">
                  {row.studentLabel}
                  {row.studentEmail ? (
                    <span className="font-normal text-zinc-500"> · {row.studentEmail}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-zinc-700">
                  {row.courseName} → {row.tutorLabel}
                  {row.delivery_mode ? ` · ${row.delivery_mode.replace("_", "-")}` : " · 1-1"}
                  {row.cohortName ? ` · ${row.cohortName}` : ""}
                </p>
                <form action={removeCourseEnrollmentForm} className="mt-2">
                  <input type="hidden" name="enrollment_id" value={row.id} />
                  <button type="submit" className={dangerButtonClass}>
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Beginners cohorts">
        <p className="mb-4 text-sm text-zinc-600">
          Cohorts are only for Beginners group delivery. Add members before assigning group
          enrollments.
        </p>

        {beginnersCourse ? (
          <form onSubmit={handleCreateCohort} className="mb-6 space-y-3 border-b border-zinc-100 pb-6">
            <div>
              <label htmlFor="cohort_name" className={labelClass}>
                New cohort name
              </label>
              <input
                id="cohort_name"
                value={newCohortName}
                onChange={(event) => setNewCohortName(event.target.value)}
                className={inputClass}
                placeholder="e.g. Beginners Group A"
              />
            </div>
            <div>
              <label htmlFor="cohort_tutor" className={labelClass}>
                Lead tutor (optional)
              </label>
              <select
                id="cohort_tutor"
                value={newCohortTutorId}
                onChange={(event) => setNewCohortTutorId(event.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                {assignableStaff.map((staff) => (
                  <option key={staff.userId} value={staff.userId}>
                    {staff.displayName} —{" "}
                    {staff.appRoles
                      .map((role) => APP_ROLE_LABELS[role as AppRole] ?? role)
                      .join(", ")}
                  </option>
                ))}
              </select>
            </div>
            <FormMessage state={cohortState} />
            <button type="submit" disabled={cohortPending || !newCohortName.trim()} className={buttonClass}>
              {cohortPending ? "Creating…" : "Create cohort"}
            </button>
          </form>
        ) : (
          <p className="mb-4 text-sm text-amber-700">No Beginners course found.</p>
        )}

        {data.cohorts.length === 0 ? (
          <p className="text-sm text-zinc-500">No cohorts yet.</p>
        ) : (
          <ul className="space-y-4">
            {data.cohorts.map((cohort) => (
              <li key={cohort.id} className="rounded-lg border border-zinc-200 p-4">
                <p className="font-semibold text-zinc-900">{cohort.name}</p>
                <p className="text-sm text-zinc-500">
                  {cohort.courseName}
                  {cohort.tutorLabel ? ` · ${cohort.tutorLabel}` : ""}
                </p>
                <ul className="mt-3 space-y-2">
                  {cohort.members.length === 0 ? (
                    <li className="text-sm text-zinc-500">No active members.</li>
                  ) : (
                    cohort.members.map((member) => (
                      <li
                        key={member.userId}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span>
                          {member.label}
                          {member.email ? (
                            <span className="text-zinc-500"> · {member.email}</span>
                          ) : null}
                        </span>
                        <form action={removeCohortMemberForm}>
                          <input type="hidden" name="cohort_id" value={cohort.id} />
                          <input type="hidden" name="user_id" value={member.userId} />
                          <button type="submit" className={secondaryButtonClass}>
                            Remove
                          </button>
                        </form>
                      </li>
                    ))
                  )}
                </ul>
                <div className="mt-4 border-t border-zinc-100 pt-4">
                  <p className={labelClass}>Add member</p>
                  <AnnouncementMemberPicker
                    selected={cohortMemberPick}
                    onChange={setCohortMemberPick}
                  />
                  <FormMessage state={addMemberState} />
                  <button
                    type="button"
                    disabled={addMemberPending || cohortMemberPick.length === 0}
                    onClick={() => handleAddCohortMember(cohort.id)}
                    className={`mt-2 ${buttonClass}`}
                  >
                    {addMemberPending ? "Adding…" : "Add to cohort"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
