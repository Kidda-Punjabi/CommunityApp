"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateGenderedNouns,
  createGenderedNoun,
  deleteGenderedNoun,
  updateGenderedNoun,
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

function GenderToggle({
  name,
  defaultValue = "masculine",
}: {
  name: string;
  defaultValue?: "masculine" | "feminine";
}) {
  return (
    <div>
      <label className={labelClass}>Gender</label>
      <div className="mt-2 flex gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50">
          <input
            type="radio"
            name={name}
            value="masculine"
            defaultChecked={defaultValue === "masculine"}
          />
          Masculine
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50">
          <input
            type="radio"
            name={name}
            value="feminine"
            defaultChecked={defaultValue === "feminine"}
          />
          Feminine
        </label>
      </div>
    </div>
  );
}

function SharedNounFields({ courses }: { courses: AdminData["courses"] }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Punjabi word</label>
          <input name="punjabi_word" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>English meaning</label>
          <input name="english_meaning" required className={inputClass} />
        </div>
      </div>
      <GenderToggle name="gender" />
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
      <div>
        <label className={labelClass}>Topic tags (comma-separated)</label>
        <input name="topic_tags" className={inputClass} placeholder="objects, food" />
      </div>
    </>
  );
}

export function GenderSortTab({ data }: { data: AdminData }) {
  const [createState, createAction, createPending] = useActionState(
    createGenderedNoun,
    initialState
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateGenderedNouns,
    initialState
  );
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionCard title="Add gendered noun">
        <form action={createAction} className="space-y-4">
          <SharedNounFields courses={data.courses} />
          <FormMessage state={createState} />
          <button type="submit" disabled={createPending} className={buttonClass}>
            {createPending ? "Saving…" : "Add noun"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Bulk import nouns">
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
            <label className={labelClass}>Paste tab-separated rows</label>
            <textarea
              name="bulk_text"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={10}
              className={inputClass}
              placeholder={"ਕੁਰਸੀ\tchair\tfeminine\t1\nਮੇਜ਼\ttable\tfeminine\t1"}
            />
            <p className="mt-1 text-xs text-zinc-500">
              Format: punjabi_word · english_meaning · gender · difficulty (optional)
            </p>
          </div>
          <FormMessage state={bulkState} />
          <button
            type="submit"
            disabled={bulkPending || !bulkText.trim()}
            className={buttonClass}
          >
            {bulkPending ? "Importing…" : "Import nouns"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Gendered nouns (${data.genderedNouns.length})`}>
        {data.genderedNouns.length === 0 ? (
          <p className="text-sm text-zinc-500">No nouns yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.genderedNouns.map((noun) =>
              editingId === noun.id ? (
                <NounEditRow
                  key={noun.id}
                  noun={noun}
                  courses={data.courses}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <li
                  key={noun.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">
                      {noun.punjabi_word} · {noun.english_meaning}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {noun.gender === "masculine" ? "Masculine" : "Feminine"} · Difficulty{" "}
                      {noun.difficulty}
                      {noun.topic_tags.length > 0 && ` · Tags: ${noun.topic_tags.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(noun.id)}
                      className={secondaryButtonClass}
                    >
                      Edit
                    </button>
                    <DeleteNounButton id={noun.id} />
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

function NounEditRow({
  noun,
  courses,
  onCancel,
  onSaved,
}: {
  noun: AdminData["genderedNouns"][0];
  courses: AdminData["courses"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateGenderedNoun, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="py-4">
      <form action={action} className="space-y-3 rounded-lg bg-zinc-50 p-4">
        <input type="hidden" name="id" value={noun.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Punjabi word</label>
            <input
              name="punjabi_word"
              defaultValue={noun.punjabi_word}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>English meaning</label>
            <input
              name="english_meaning"
              defaultValue={noun.english_meaning}
              required
              className={inputClass}
            />
          </div>
        </div>
        <GenderToggle name="gender" defaultValue={noun.gender} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Difficulty (1–5)</label>
            <input
              name="difficulty"
              type="number"
              min={1}
              max={5}
              defaultValue={noun.difficulty}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Course (optional)</label>
            <select
              name="course_id"
              defaultValue={noun.course_id ?? ""}
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
        <div>
          <label className={labelClass}>Topic tags (comma-separated)</label>
          <input
            name="topic_tags"
            defaultValue={noun.topic_tags.join(", ")}
            className={inputClass}
          />
        </div>
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

function DeleteNounButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this noun?")) return;
        setPending(true);
        const formData = new FormData();
        formData.set("id", id);
        await deleteGenderedNoun({}, formData);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
