"use client";

import {
  getConjugationForm,
  type VerbConjugations,
} from "@/lib/games/types";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateVerbConjugations,
  createVerbConjugation,
  deleteVerbConjugation,
  updateVerbConjugation,
  type GrammarActionResult,
} from "../grammar-actions";
import type { AdminData } from "../types";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initialState: GrammarActionResult = {};

const CONJUGATION_FIELDS = [
  { name: "present_singular_masculine", label: "Present · singular · masculine" },
  { name: "present_singular_feminine", label: "Present · singular · feminine" },
  { name: "present_plural_masculine", label: "Present · plural · masculine" },
  { name: "present_plural_feminine", label: "Present · plural · feminine" },
  { name: "past_singular_masculine", label: "Past · singular · masculine" },
  { name: "past_singular_feminine", label: "Past · singular · feminine" },
  { name: "past_plural_masculine", label: "Past · plural · masculine" },
  { name: "past_plural_feminine", label: "Past · plural · feminine" },
  { name: "future_singular_masculine", label: "Future · singular · masculine" },
  { name: "future_singular_feminine", label: "Future · singular · feminine" },
  { name: "future_plural_masculine", label: "Future · plural · masculine" },
  { name: "future_plural_feminine", label: "Future · plural · feminine" },
] as const;

function conjugationFieldValue(
  conjugations: Record<string, unknown>,
  fieldName: (typeof CONJUGATION_FIELDS)[number]["name"]
): string {
  const [tense, number, gender] = fieldName.split("_") as [
    "present" | "past" | "future",
    "singular" | "plural",
    "masculine" | "feminine",
  ];
  return (
    getConjugationForm(conjugations as VerbConjugations, tense, number, gender) ?? ""
  );
}

function ConjugationFields({
  conjugations,
}: {
  conjugations?: Record<string, unknown>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CONJUGATION_FIELDS.map((field) => (
        <div key={field.name}>
          <label className={labelClass}>{field.label}</label>
          <input
            name={field.name}
            defaultValue={conjugations ? conjugationFieldValue(conjugations, field.name) : ""}
            className={inputClass}
          />
        </div>
      ))}
    </div>
  );
}

function SharedVerbFields({ courses }: { courses: AdminData["courses"] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Verb root (Punjabi)</label>
          <input name="verb_root" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Meaning (English)</label>
          <input name="verb_meaning" required className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Difficulty (1–5)</label>
          <input
            name="difficulty"
            type="number"
            min={1}
            max={5}
            defaultValue={1}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Course (optional)</label>
          <select name="course_id" className={inputClass}>
            <option value="">Any course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}

export function ConjugationTab({ data }: { data: AdminData }) {
  const [createState, createAction, createPending] = useActionState(
    createVerbConjugation,
    initialState
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateVerbConjugations,
    initialState
  );
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionCard title="Add verb conjugation">
        <form action={createAction} className="space-y-4">
          <SharedVerbFields courses={data.courses} />
          <ConjugationFields />
          <FormMessage state={createState} />
          <button type="submit" disabled={createPending} className={buttonClass}>
            {createPending ? "Saving…" : "Add verb"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Bulk import verbs">
        <form action={bulkAction} className="space-y-4">
          <div>
            <label className={labelClass}>Course (optional)</label>
            <select name="course_id" className={inputClass}>
              <option value="">Any course</option>
              {data.courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Paste verbs</label>
            <textarea
              name="bulk_text"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={14}
              className={inputClass}
              placeholder={
                "VERB: ਜਾਣਾ\nMEANING: to go\nDIFFICULTY: 1\npresent_singular_masculine: ਜਾਂਦਾ\npresent_singular_feminine: ਜਾਂਦੀ\n..."
              }
            />
          </div>
          <FormMessage state={bulkState} />
          <button
            type="submit"
            disabled={bulkPending || !bulkText.trim()}
            className={buttonClass}
          >
            {bulkPending ? "Importing…" : "Import verbs"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Verb conjugations (${data.verbConjugations.length})`}>
        {data.verbConjugations.length === 0 ? (
          <p className="text-sm text-zinc-500">No verbs yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.verbConjugations.map((verb) =>
              editingId === verb.id ? (
                <VerbEditRow
                  key={verb.id}
                  verb={verb}
                  courses={data.courses}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <li
                  key={verb.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {verb.verb_root} · {verb.verb_meaning}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Difficulty {verb.difficulty}
                    </p>
                    <div className="mt-3 grid gap-1 text-xs text-zinc-600 sm:grid-cols-2">
                      {CONJUGATION_FIELDS.map((field) => {
                        const value = conjugationFieldValue(verb.conjugations, field.name);
                        if (!value) return null;
                        return (
                          <p key={field.name}>
                            <span className="text-zinc-400">{field.label}:</span> {value}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(verb.id)}
                      className={secondaryButtonClass}
                    >
                      Edit
                    </button>
                    <DeleteVerbButton id={verb.id} />
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function VerbEditRow({
  verb,
  courses,
  onCancel,
  onSaved,
}: {
  verb: AdminData["verbConjugations"][0];
  courses: AdminData["courses"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateVerbConjugation, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="py-4">
      <form action={action} className="space-y-3 rounded-lg bg-zinc-50 p-4">
        <input type="hidden" name="id" value={verb.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Verb root (Punjabi)</label>
            <input
              name="verb_root"
              defaultValue={verb.verb_root}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Meaning (English)</label>
            <input
              name="verb_meaning"
              defaultValue={verb.verb_meaning}
              required
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Difficulty (1–5)</label>
            <input
              name="difficulty"
              type="number"
              min={1}
              max={5}
              defaultValue={verb.difficulty}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Course (optional)</label>
            <select
              name="course_id"
              defaultValue={verb.course_id ?? ""}
              className={inputClass}
            >
              <option value="">Any course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ConjugationFields conjugations={verb.conjugations} />
        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function DeleteVerbButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this verb?")) return;
        setPending(true);
        const formData = new FormData();
        formData.set("id", id);
        await deleteVerbConjugation({}, formData);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
