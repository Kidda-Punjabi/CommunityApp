"use client";

import { useState } from "react";
import { PublicCohortSelect } from "@/components/public-forms/public-cohort-select";
import { validateGuestIdentity, type GuestIdentity } from "@/lib/public-forms/guest";
import { ui } from "@/lib/ui/styles";

export type PublicGuestCourseOptions = {
  cohorts: readonly string[];
  tutors: readonly string[];
  cohortPlaceholder?: string;
};

type PublicGuestGateProps = {
  onContinue: (identity: GuestIdentity) => void;
  courseOptions?: PublicGuestCourseOptions;
};

export function PublicGuestGate({ onContinue, courseOptions }: PublicGuestGateProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cohort, setCohort] = useState("");
  const [tutor, setTutor] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = validateGuestIdentity({ fullName, email, phone });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (courseOptions) {
      if (!cohort) {
        setError("Please choose your cohort.");
        return;
      }
      if (!tutor) {
        setError("Please choose your tutor.");
        return;
      }
      if (!courseOptions.cohorts.includes(cohort)) {
        setError("Please choose a valid cohort.");
        return;
      }
      if (!courseOptions.tutors.includes(tutor)) {
        setError("Please choose a valid tutor.");
        return;
      }
    }
    setError(null);
    onContinue(
      courseOptions ? { ...result.identity, cohort, tutor } : result.identity
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${ui.stack}`}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Before you start</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your details so we can match this to your course.
        </p>
      </div>

      <label className="block text-sm font-medium text-zinc-700">
        Full name
        <input
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Phone
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      {courseOptions ? (
        <>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="guest-cohort">
            Cohort
            <PublicCohortSelect
              id="guest-cohort"
              value={cohort}
              onChange={setCohort}
              cohorts={courseOptions.cohorts}
              placeholder={courseOptions.cohortPlaceholder ?? "Select your cohort"}
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700" htmlFor="guest-tutor">
            Tutor
            <select
              id="guest-tutor"
              value={tutor}
              onChange={(event) => setTutor(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
              required
            >
              <option value="">Select your tutor</option>
              {courseOptions.tutors.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button type="submit" className={ui.btnPrimaryBlock}>
        Continue
      </button>
    </form>
  );
}
