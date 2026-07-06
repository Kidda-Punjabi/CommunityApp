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
};

export function SetAssociationFields({
  defaultAssociation = "uncategorized",
  defaultWeekNumber = null,
}: SetAssociationFieldsProps) {
  const [association, setAssociation] = useState<FlashcardSetCourseAssociation>(
    defaultAssociation
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={association === "beginners" ? "" : "sm:col-span-2"}>
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
      {association === "beginners" && (
        <div>
          <label className={labelClass}>Week (1–12)</label>
          <input
            name="week_number"
            type="number"
            min={1}
            max={12}
            required
            defaultValue={defaultWeekNumber ?? ""}
            className={inputClass}
            placeholder="e.g. 1"
          />
        </div>
      )}
    </div>
  );
}
