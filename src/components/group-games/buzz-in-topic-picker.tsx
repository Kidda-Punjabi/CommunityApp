"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BUZZ_IN_MIN_QUESTIONS,
  type BuzzInCourseId,
  type BuzzInSelection,
  type BuzzInTopicCatalogue,
} from "@/lib/buzz-in/topic-catalogue";

type Tab = "week" | "themes" | "mixed";

type BuzzInTopicPickerProps = {
  catalogue: BuzzInTopicCatalogue;
  /** Tells the form whether there's a valid pick (so Create can be disabled). */
  onReadyChange?: (ready: boolean) => void;
};

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "week", label: "Course week" },
  { id: "themes", label: "Themes" },
  { id: "mixed", label: "Mixed" },
];

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function BuzzInTopicPicker({ catalogue, onReadyChange }: BuzzInTopicPickerProps) {
  const availableCourses = catalogue.courses.filter((course) => course.available);
  const [tab, setTab] = useState<Tab>("week");
  const [courseId, setCourseId] = useState<BuzzInCourseId>(
    availableCourses[0]?.id ?? "beginners"
  );
  const [week, setWeek] = useState<number | null>(null);
  const [themeIds, setThemeIds] = useState<string[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const courseButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const course = catalogue.courses.find((item) => item.id === courseId) ?? null;

  const selection: BuzzInSelection | null = useMemo(() => {
    if (tab === "themes") return themeIds.length > 0 ? { mode: "themes", themeIds } : null;
    if (!course?.available) return null;
    if (tab === "mixed") {
      return course.mixedCount >= BUZZ_IN_MIN_QUESTIONS ? { mode: "mixed", courseId } : null;
    }
    return week != null ? { mode: "week", courseId, week } : null;
  }, [tab, themeIds, course, courseId, week]);

  const summary = useMemo(() => {
    if (tab === "themes") {
      const names = catalogue.themes
        .filter((theme) => themeIds.includes(theme.id))
        .map((theme) => theme.label);
      return names.length ? names.join(", ") : "Pick one or more themes";
    }
    if (!course) return "";
    if (tab === "mixed") return `Everything from ${course.label}`;
    const picked = course.weeks.find((item) => item.number === week);
    return picked ? `Week ${picked.number}: ${picked.title}` : "Pick a week";
  }, [tab, themeIds, catalogue.themes, course, week]);

  useEffect(() => {
    onReadyChange?.(selection !== null);
  }, [selection, onReadyChange]);

  useEffect(() => {
    if (!sheetOpen) return;
    const returnTo = courseButtonRef.current;
    sheetRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnTo?.focus();
    };
  }, [sheetOpen]);

  function pickCourse(id: BuzzInCourseId) {
    setCourseId(id);
    setWeek(null);
    setSheetOpen(false);
  }

  function toggleTheme(id: string) {
    setThemeIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const courseButton = (
    <button
      ref={courseButtonRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={sheetOpen}
      onClick={() => setSheetOpen(true)}
      className="flex h-14 w-full items-center gap-3 rounded-2xl border border-zinc-300 bg-white px-4 text-left"
    >
      <span className="flex flex-1 flex-col">
        <span className="text-xs font-semibold text-zinc-500">Course</span>
        <span className="text-base font-bold text-zinc-900">{course?.label ?? "Choose"}</span>
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-zinc-900">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 rounded-[14px] bg-zinc-100 p-1" role="tablist" aria-label="What to practise">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={`h-10 rounded-[10px] text-sm transition-colors ${
                active ? "bg-white font-bold text-zinc-900 shadow-sm" : "font-semibold text-zinc-600"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "week" ? (
        <div className="space-y-3">
          {courseButton}
          <p className="text-sm text-zinc-600">
            Pick the week you have just covered. Questions only come from that lesson.
          </p>
          {course && course.weeks.every((item) => item.count < BUZZ_IN_MIN_QUESTIONS) ? (
            <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              No {course.label} questions are available on your account yet. Try Themes instead.
            </p>
          ) : null}
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Week">
            {(course?.weeks ?? []).map((item) => {
              const active = week === item.number;
              const tooFew = item.count < BUZZ_IN_MIN_QUESTIONS;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={tooFew}
                  onClick={() => setWeek(item.number)}
                  className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border-2 py-2 pl-2 pr-3.5 text-left transition-colors ${
                    active
                      ? "border-violet-600 bg-violet-50"
                      : tooFew
                        ? "border-zinc-200 bg-zinc-50"
                        : "border-zinc-200 bg-white hover:border-violet-300"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold ${
                      active ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {item.number}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[15px] font-bold ${tooFew ? "text-zinc-500" : "text-zinc-900"}`}>
                      {item.title}
                    </span>
                    <span className="text-xs font-medium text-zinc-600">
                      {tooFew ? "Not enough cards yet" : `${item.count} cards`}
                    </span>
                  </span>
                  <span
                    className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 ${
                      active ? "border-violet-600" : "border-zinc-400"
                    }`}
                  >
                    {active ? <span className="h-2.5 w-2.5 rounded-full bg-violet-600" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "themes" ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-600">Pick one or more everyday themes.</p>
          {catalogue.themes.every((theme) => theme.count < BUZZ_IN_MIN_QUESTIONS) ? (
            <p className="rounded-2xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">
              No themes have enough questions on your account yet.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            {catalogue.themes
              .filter((theme) => theme.count >= BUZZ_IN_MIN_QUESTIONS)
              .map((theme) => {
                const active = themeIds.includes(theme.id);
                return (
                  <button
                    key={theme.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleTheme(theme.id)}
                    className={`flex h-[52px] items-center justify-between gap-2 rounded-2xl border-2 px-3.5 text-left transition-colors ${
                      active ? "border-violet-600 bg-violet-50" : "border-zinc-200 bg-white hover:border-violet-300"
                    }`}
                  >
                    <span className="text-[15px] font-bold leading-tight text-zinc-900">{theme.label}</span>
                    <span
                      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2 ${
                        active ? "border-violet-600 bg-violet-600 text-white" : "border-zinc-400"
                      }`}
                    >
                      {active ? <CheckIcon /> : null}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      ) : null}

      {tab === "mixed" ? (
        <div className="space-y-3">
          {courseButton}
          <p className="text-sm text-zinc-600">
            {course && course.mixedCount >= BUZZ_IN_MIN_QUESTIONS
              ? `A mix of every week in ${course.label} (${course.mixedCount} cards).`
              : "There aren't enough cards in this course yet."}
          </p>
        </div>
      ) : null}

      <div className="flex justify-between gap-3 text-[13px] font-semibold text-zinc-600">
        <span className="min-w-0 truncate">{summary}</span>
      </div>

      <input
        type="hidden"
        name="buzz_in_selection"
        value={selection ? JSON.stringify(selection) : ""}
      />

      {sheetOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end bg-zinc-900/45" onClick={() => setSheetOpen(false)}>
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose a course"
            onClick={(event) => event.stopPropagation()}
            className="mx-auto flex w-full max-w-lg flex-col gap-2 rounded-t-[28px] bg-white px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] pt-3"
          >
            <span className="mx-auto h-[5px] w-10 rounded-full bg-zinc-300" />
            <span className="pb-1.5 pt-2.5 text-lg font-extrabold text-zinc-900">Choose a course</span>
            {catalogue.courses.map((item) => {
              const active = item.id === courseId;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!item.available}
                  onClick={() => pickCourse(item.id)}
                  className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left ${
                    active
                      ? "border-violet-600 bg-violet-50"
                      : item.available
                        ? "border-zinc-200 bg-white"
                        : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <span className="flex flex-1 flex-col gap-0.5">
                    <span className={`text-base font-bold ${item.available ? "text-zinc-900" : "text-zinc-500"}`}>
                      {item.label}
                    </span>
                    <span className="text-[13px] font-medium text-zinc-600">{item.subtitle}</span>
                  </span>
                  {!item.available ? (
                    <span className="rounded-[10px] bg-zinc-100 px-2.5 py-1 text-xs font-bold text-zinc-600">
                      Coming soon
                    </span>
                  ) : null}
                  {active ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white">
                      <CheckIcon />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
