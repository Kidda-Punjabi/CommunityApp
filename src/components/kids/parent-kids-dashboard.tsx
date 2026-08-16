"use client";

import { useState } from "react";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { PinPad } from "@/components/kids/pin-pad";
import type { ParentKidCourseProgress } from "@/lib/kids/load-parent-course-progress";
import type { KidProgressSummary } from "@/lib/kids/types";

export function ParentKidsDashboard({
  summaries,
  courseProgress = [],
  hasPin,
}: {
  summaries: KidProgressSummary[];
  courseProgress?: ParentKidCourseProgress[];
  hasPin: boolean;
}) {
  const [showPinChange, setShowPinChange] = useState(false);
  const [showForgotPin, setShowForgotPin] = useState(false);

  return (
    <div className="mt-6 space-y-6">
      {summaries.length === 0 ? (
        <p className="text-sm text-zinc-600">No kid profiles yet.</p>
      ) : (
        <div className="space-y-3">
          {summaries.map((summary) => (
            <KidSummaryCard key={summary.profile.id} summary={summary} />
          ))}
        </div>
      )}

      {courseProgress.some((row) => row.courses.length > 0) ? (
        <div className="space-y-4">
          <h2 className="font-semibold text-zinc-900">Course progress</h2>
          {courseProgress.map((row) =>
            row.courses.length === 0 ? null : (
              <KidCourseProgressCard key={row.profile.id} progress={row} />
            )
          )}
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="font-semibold text-zinc-900">Grown-up PIN</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Required to switch back from a kid profile to your account.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPinChange(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {hasPin ? "Change PIN" : "Set PIN"}
          </button>
          {hasPin && (
            <button
              type="button"
              onClick={() => setShowForgotPin(true)}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700"
            >
              Forgot PIN
            </button>
          )}
        </div>
      </div>

      {showPinChange && (
        <ChangePinDialog hasPin={hasPin} onClose={() => setShowPinChange(false)} />
      )}
      {showForgotPin && <ForgotPinDialog onClose={() => setShowForgotPin(false)} />}
    </div>
  );
}

function KidSummaryCard({ summary }: { summary: KidProgressSummary }) {
  const [editing, setEditing] = useState(false);
  const { profile } = summary;
  const usesStickers = profile.age_tier !== "independent";

  async function handleDelete() {
    if (!confirm(`Remove ${profile.name}'s profile?`)) return;
    await fetch(`/api/kids/profiles/${profile.id}`, { method: "DELETE" });
    window.location.reload();
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
          <KidLucideIcon name={profile.avatar_icon} className="h-7 w-7 text-sky-600" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-900">{profile.name}</p>
          <p className="text-xs capitalize text-zinc-500">{profile.age_tier.replace("_", " ")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="text-sm font-medium text-violet-600"
        >
          Edit
        </button>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-white p-2">
          <dt className="text-zinc-400">Activities</dt>
          <dd className="font-bold text-zinc-900">{summary.activitiesCompleted}</dd>
        </div>
        {usesStickers ? (
          <div className="rounded-lg bg-white p-2">
            <dt className="text-zinc-400">Stickers</dt>
            <dd className="font-bold text-zinc-900">{summary.stickersEarned}</dd>
          </div>
        ) : (
          <div className="rounded-lg bg-white p-2">
            <dt className="text-zinc-400">XP mode</dt>
            <dd className="font-bold text-zinc-900">Full app</dd>
          </div>
        )}
        <div className="rounded-lg bg-white p-2">
          <dt className="text-zinc-400">Last active</dt>
          <dd className="font-bold text-zinc-900">
            {summary.lastActiveAt
              ? new Date(summary.lastActiveAt).toLocaleDateString()
              : "—"}
          </dd>
        </div>
      </dl>
      {editing && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600"
          >
            Remove profile
          </button>
        </div>
      )}
    </div>
  );
}

function homeworkTimingLabel(
  status: ParentKidCourseProgress["courses"][number]["lessons"][number]["homeworkStatus"],
  timing: ParentKidCourseProgress["courses"][number]["lessons"][number]["homeworkTiming"]
) {
  if (status === "not_submitted") return "Not submitted";
  if (timing === "late") return "Late";
  if (timing === "post_lesson") return "Post-lesson";
  if (timing === "on_time") return "On time";
  return status === "reviewed" ? "Reviewed" : "Pending review";
}

function KidCourseProgressCard({ progress }: { progress: ParentKidCourseProgress }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="font-semibold text-zinc-900">{progress.profile.name}</p>
      {progress.courses.map((course) => (
        <div key={course.courseId} className="mt-3">
          <p className="text-sm font-medium text-zinc-700">{course.courseName}</p>
          <ul className="mt-2 space-y-2">
            {course.lessons.map((lesson) => (
              <li
                key={lesson.lessonId}
                className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-700"
              >
                <p className="font-semibold text-zinc-900">
                  Lesson {lesson.lessonNumber}: {lesson.lessonTitle}
                </p>
                <p className="mt-1">
                  Homework: {homeworkTimingLabel(lesson.homeworkStatus, lesson.homeworkTiming)}
                  {lesson.attended === true
                    ? " · Present"
                    : lesson.attended === false
                      ? " · Absent"
                      : " · Attendance not marked"}
                </p>
                {lesson.tutorComment ? (
                  <p className="mt-1 text-zinc-600">Tutor (homework): {lesson.tutorComment}</p>
                ) : null}
                {lesson.attendanceNote ? (
                  <p className="mt-1 text-zinc-600">Tutor (attendance): {lesson.attendanceNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ChangePinDialog({ hasPin, onClose }: { hasPin: boolean; onClose: () => void }) {
  const [step, setStep] = useState<"current" | "new" | "confirm">(hasPin ? "current" : "new");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function save(confirmed: string) {
    const response = await fetch("/api/kids/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        hasPin
          ? { newPin, confirmNewPin: confirmed, currentPin }
          : { pin: newPin, confirmPin: confirmed }
      ),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Failed to save PIN.");
      return;
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6">
        <PinPad
          title={
            step === "current"
              ? "Current PIN"
              : step === "new"
                ? "New PIN"
                : "Confirm new PIN"
          }
          onComplete={(pin) => {
            setError(null);
            if (step === "current") {
              setCurrentPin(pin);
              setStep("new");
            } else if (step === "new") {
              setNewPin(pin);
              setStep("confirm");
            } else if (pin !== newPin) {
              setError("PINs don't match.");
              setStep("new");
              setNewPin("");
            } else {
              void save(pin);
            }
          }}
          onCancel={onClose}
          error={error}
        />
      </div>
    </div>
  );
}

function ForgotPinDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [step, setStep] = useState<"login" | "pin" | "confirm">("login");
  const [error, setError] = useState<string | null>(null);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setStep("pin");
  }

  async function savePin(confirmed: string) {
    const response = await fetch("/api/kids/pin/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, newPin, confirmNewPin: confirmed }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Reset failed.");
      return;
    }
    onClose();
  }

  if (step === "login") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <form onSubmit={submitLogin} className="w-full max-w-sm rounded-3xl bg-white p-6">
          <h2 className="text-lg font-bold">Reset PIN</h2>
          <p className="mt-1 text-sm text-zinc-500">Confirm your account password first.</p>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-4 w-full rounded-xl border px-3 py-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 w-full rounded-xl border px-3 py-2"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border py-2">
              Cancel
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-violet-600 py-2 text-white">
              Continue
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6">
        <PinPad
          title={step === "pin" ? "New PIN" : "Confirm PIN"}
          onComplete={(pin) => {
            if (step === "pin") {
              setNewPin(pin);
              setStep("confirm");
            } else if (pin !== newPin) {
              setError("PINs don't match.");
              setStep("pin");
            } else {
              void savePin(pin);
            }
          }}
          onCancel={onClose}
          error={error}
        />
      </div>
    </div>
  );
}
