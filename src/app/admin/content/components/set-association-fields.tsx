"use client";

import { useState } from "react";
import type { FlashcardSetCourseAssociation } from "../types";
import { inputClass, labelClass } from "./ui";

const ASSOCIATION_OPTIONS: {
  value: FlashcardSetCourseAssociation;
  label: string;
}[] = [
  { value: "foundations", label: "Foundations course" },
  { value: "beginners", label: "Beginners course (12-week program)" },
  { value: "community", label: "Community / general practice" },
  { value: "uncategorized", label: "Uncategorized (needs review)" },
];

type SetAssociationFieldsProps = {
  defaultAssociation?: FlashcardSetCourseAssociation;
  defaultWeekNumber?: number | null;
  linkSummary?: string;
};

export function SetAssociationFields({
  defaultAssociation = "uncategorized",
  defaultWeekNumber = null,
  linkSummary,
}: SetAssociationFieldsProps) {
  const [association, setAssociation] = useState<FlashcardSetCourseAssociation>(
    defaultAssociation
  );

  const showWeek =
    association === "beginners" ||
    association === "foundations" ||
    association === "community";
  const weekMax = association === "community" ? 24 : 12;
  const weekRequired = association === "beginners";
  const weekLabel =
    association === "community"
      ? "Community lesson (1–24)"
      : association === "foundations"
        ? "Lesson week (1–4, optional for course-wide sets)"
        : "Week (1–12)";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={showWeek ? "" : "sm:col-span-2"}>
          <label className={labelClass}>Course</label>
          <select
            name="course_association"
            value={association}
            onChange={(event) =>
              setAssociation(event.target.value as FlashcardSetCourseAssociation)
            }
            className={inputClass}
          >
            {ASSOCIATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {showWeek && (
          <div>
            <label className={labelClass}>{weekLabel}</label>
            <input
              name="week_number"
              type="number"
              min={1}
              max={weekMax}
              required={weekRequired}
              defaultValue={defaultWeekNumber ?? ""}
              className={inputClass}
              placeholder={weekRequired ? "Required" : "Optional"}
            />
          </div>
        )}
      </div>
      {linkSummary && (
        <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          <span className="font-medium">Linked to:</span> {linkSummary}
        </p>
      )}
    </div>
  );
}
