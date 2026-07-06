"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateFlashcards,
  createFlashcard,
  createFlashcardSet,
  deleteFlashcard,
  deleteFlashcardSet,
  updateFlashcard,
  updateFlashcardSet,
  type ActionResult,
} from "../actions";
import type { AdminData, FlashcardCategory, FlashcardSet } from "../types";
import { parseBulkFlashcards } from "@/lib/admin/parse-bulk-flashcards";
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

const CATEGORY_OPTIONS: { value: FlashcardCategory | ""; label: string }[] = [
  { value: "", label: "No category" },
  { value: "alphabet", label: "Alphabet" },
  { value: "vocab", label: "Vocab" },
  { value: "sentences", label: "Sentences" },
];

type CardMetadataDefaults = {
  category?: string;
  difficulty?: string;
  topic_tags?: string;
  icon_name?: string;
};

const FLASHCARDS_EDITING_SET_KEY = "admin-flashcards-editing-set-id";

function readEditingSetId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(FLASHCARDS_EDITING_SET_KEY);
}

function persistEditingSetId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) sessionStorage.setItem(FLASHCARDS_EDITING_SET_KEY, id);
  else sessionStorage.removeItem(FLASHCARDS_EDITING_SET_KEY);
}

export function FlashcardsTab({ data }: { data: AdminData }) {
  const [editingSetId, setEditingSetId] = useState<string | null>(() => readEditingSetId());
  const [createSetState, createSetAction, createSetPending] = useActionState(
    createFlashcardSet,
    initialState
  );

  const cardCountBySet = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of data.flashcards) {
      if (!card.deck_id) continue;
      counts.set(card.deck_id, (counts.get(card.deck_id) ?? 0) + 1);
    }
    return counts;
  }, [data.flashcards]);

  const editingSet = editingSetId
    ? data.flashcardSets.find((set) => set.id === editingSetId) ?? null
    : null;

  useEffect(() => {
    if (editingSetId && !editingSet) {
      setEditingSetId(null);
      persistEditingSetId(null);
    }
  }, [editingSetId, editingSet]);

  if (editingSet) {
    return (
      <FlashcardSetEditView
        data={data}
        set={editingSet}
        cards={data.flashcards.filter((card) => card.deck_id === editingSet.id)}
        onBack={() => {
          setEditingSetId(null);
          persistEditingSetId(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Create flashcard set">
        <form action={createSetAction} className="space-y-4">
          <div>
            <label className={labelClass}>Set name</label>
            <input name="name" required placeholder="e.g. Greetings" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description (optional)</label>
            <textarea name="description" rows={2} className={inputClass} />
          </div>
          <FormMessage state={createSetState} />
          <button type="submit" disabled={createSetPending} className={buttonClass}>
            {createSetPending ? "Creating…" : "Create set"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Flashcard sets (${data.flashcardSets.length})`}>
        {data.flashcardSets.length === 0 ? (
          <p className="text-sm text-zinc-500">No flashcard sets yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.flashcardSets.map((set) => (
              <li
                key={set.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-zinc-900">{set.name}</p>
                  {set.description && (
                    <p className="mt-1 text-sm text-zinc-500">{set.description}</p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400">
                    {cardCountBySet.get(set.id) ?? 0} card
                    {(cardCountBySet.get(set.id) ?? 0) === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSetId(set.id);
                      persistEditingSetId(set.id);
                    }}
                    className={secondaryButtonClass}
                  >
                    Edit
                  </button>
                  <DeleteFlashcardSetButton id={set.id} name={set.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function FlashcardSetEditView({
  data,
  set,
  cards,
  onBack,
}: {
  data: AdminData;
  set: FlashcardSet;
  cards: AdminData["flashcards"];
  onBack: () => void;
}) {
  const router = useRouter();
  const [setState, setAction, setPending] = useActionState(updateFlashcardSet, initialState);
  const [cardState, cardAction, cardPending] = useActionState(createFlashcard, initialState);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateFlashcards,
    initialState
  );
  const [bulkText, setBulkText] = useState("");
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const bulkFormRef = useRef<HTMLFormElement>(null);

  const linkedCourseIds = data.setCourseLinks
    .filter((link) => link.deck_id === set.id && link.course_id)
    .map((link) => link.course_id as string);

  const linkedLessonIds = data.setCourseLinks
    .filter((link) => link.deck_id === set.id && link.lesson_id)
    .map((link) => link.lesson_id as string);

  const bulkPreview = useMemo(() => parseBulkFlashcards(bulkText), [bulkText]);

  useEffect(() => {
    if (setState.success) router.refresh();
  }, [setState.success, router]);

  useEffect(() => {
    if (cardState.success) router.refresh();
  }, [cardState.success, router]);

  useEffect(() => {
    if (!bulkState.success) return;
    setBulkText("");
    router.refresh();
  }, [bulkState.success, router]);

  const submitBulkImport = () => {
    if (!bulkFormRef.current || bulkPreview.items.length === 0) return;

    const formData = new FormData(bulkFormRef.current);
    formData.set("deck_id", set.id);
    formData.set("bulk_text", bulkText);
    bulkAction(formData);
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-sm font-medium text-violet-600">
        ← Back to sets
      </button>

      <SectionCard title={`Edit set: ${set.name}`}>
        <form action={setAction} className="space-y-4">
          <input type="hidden" name="id" value={set.id} />
          <div>
            <label className={labelClass}>Set name</label>
            <input name="name" required defaultValue={set.name} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={set.description ?? ""}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Relevant courses</label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-3">
              {data.courses.map((course) => (
                <label
                  key={course.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="course_ids"
                    value={course.id}
                    defaultChecked={linkedCourseIds.includes(course.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-violet-600"
                  />
                  <span className="font-medium">{course.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Relevant lessons</label>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-3">
              {data.lessons.map((lesson) => (
                <label
                  key={lesson.id}
                  className="flex cursor-pointer items-center gap-2 text-sm text-zinc-900"
                >
                  <input
                    type="checkbox"
                    name="lesson_ids"
                    value={lesson.id}
                    defaultChecked={linkedLessonIds.includes(lesson.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-violet-600"
                  />
                  <span className="font-medium">
                    {lesson.courses?.name} · Lesson {lesson.lesson_number}: {lesson.title}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <FormMessage state={setState} />
          <button type="submit" disabled={setPending} className={buttonClass}>
            {setPending ? "Saving…" : "Save set"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Add card">
        <form action={cardAction} className="space-y-4">
          <input type="hidden" name="deck_id" value={set.id} />
          <CardMetadataFields />
          <div>
            <label className={labelClass}>Front text</label>
            <textarea name="front_text" required rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Back text</label>
            <textarea name="back_text" required rows={2} className={inputClass} />
          </div>
          <FormMessage state={cardState} />
          <button type="submit" disabled={cardPending} className={buttonClass}>
            {cardPending ? "Saving…" : "Add card"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Bulk import cards">
        <div className="space-y-4">
          <form ref={bulkFormRef} className="space-y-4" onSubmit={(event) => event.preventDefault()}>
            <CardMetadataFields />
            <div>
              <label className={labelClass}>Rows (tab, pipe, or two spaces between front and back)</label>
              <textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                rows={8}
                className={inputClass}
                placeholder={"Sat Sri Akal\tHello\nDhanvaad | Thank you\nPani  Water"}
              />
            </div>
            {bulkPreview.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <p className="font-medium">Parse warnings:</p>
                <ul className="mt-1 list-disc pl-5">
                  {bulkPreview.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
            {bulkPreview.items.length > 0 && (
              <p className="text-sm text-zinc-600">
                {bulkPreview.items.length} card{bulkPreview.items.length === 1 ? "" : "s"} ready
                to import
              </p>
            )}
            <FormMessage state={bulkState} />
            <button
              type="button"
              onClick={submitBulkImport}
              disabled={bulkPending || bulkPreview.items.length === 0}
              className={buttonClass}
            >
              {bulkPending ? "Importing…" : "Import cards into this set"}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard title={`Cards in set (${cards.length})`}>
        {cards.length === 0 ? (
          <p className="text-sm text-zinc-500">No cards in this set yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {cards.map((card) =>
              editingCardId === card.id ? (
                <FlashcardEditRow
                  key={card.id}
                  card={card}
                  setId={set.id}
                  onCancel={() => setEditingCardId(null)}
                  onSaved={() => setEditingCardId(null)}
                />
              ) : (
                <li
                  key={card.id}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{card.front_text}</p>
                    <p className="mt-1 text-zinc-500">{card.back_text}</p>
                    <CardMetaSummary card={card} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingCardId(card.id)}
                      className={secondaryButtonClass}
                    >
                      Edit
                    </button>
                    <DeleteFlashcardButton id={card.id} />
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

function CardMetadataFields({ defaults }: { defaults?: CardMetadataDefaults }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className={labelClass}>Category</label>
        <select
          name="category"
          defaultValue={defaults?.category ?? ""}
          className={inputClass}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value || "none"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Difficulty (1–5)</label>
        <input
          name="difficulty"
          type="number"
          min={1}
          max={5}
          defaultValue={defaults?.difficulty ?? ""}
          className={inputClass}
          placeholder="Optional"
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Topic tags (comma-separated)</label>
        <input
          name="topic_tags"
          defaultValue={defaults?.topic_tags ?? ""}
          className={inputClass}
          placeholder="food, greetings"
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Icon name (Lucide, optional)</label>
        <input
          name="icon_name"
          defaultValue={defaults?.icon_name ?? ""}
          className={inputClass}
          placeholder="e.g. apple"
        />
      </div>
    </div>
  );
}

function CardMetaSummary({ card }: { card: AdminData["flashcards"][0] }) {
  const parts: string[] = [];
  if (card.category) parts.push(card.category);
  if (card.difficulty) parts.push(`level ${card.difficulty}`);
  if (card.topic_tags?.length) parts.push(card.topic_tags.join(", "));
  if (card.icon_name) parts.push(`icon: ${card.icon_name}`);
  if (parts.length === 0) return null;

  return <p className="mt-1 text-xs text-zinc-400">{parts.join(" · ")}</p>;
}

function FlashcardEditRow({
  card,
  setId,
  onCancel,
  onSaved,
}: {
  card: AdminData["flashcards"][0];
  setId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateFlashcard, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="py-3">
      <form action={action} className="space-y-3 rounded-lg bg-zinc-50 p-3">
        <input type="hidden" name="id" value={card.id} />
        <input type="hidden" name="deck_id" value={setId} />
        <CardMetadataFields
          defaults={{
            category: card.category ?? "",
            difficulty: card.difficulty?.toString() ?? "",
            topic_tags: card.topic_tags?.join(", ") ?? "",
            icon_name: card.icon_name ?? "",
          }}
        />
        <textarea
          name="front_text"
          defaultValue={card.front_text}
          rows={2}
          className={inputClass}
          required
        />
        <textarea
          name="back_text"
          defaultValue={card.back_text}
          rows={2}
          className={inputClass}
          required
        />
        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            Save
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function DeleteFlashcardButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this flashcard?")) return;
        setPending(true);
        await deleteFlashcard(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}

function DeleteFlashcardSetButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm(`Delete "${name}" and all its cards?`)) return;
        setPending(true);
        await deleteFlashcardSet(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
