"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateFlashcards,
  createFlashcard,
  deleteFlashcard,
  updateFlashcard,
  type ActionResult,
} from "../actions";
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

const initialState: ActionResult = {};

export function FlashcardsTab({ data }: { data: AdminData }) {
  const [state, action, pending] = useActionState(createFlashcard, initialState);
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateFlashcards,
    initialState
  );
  const [bulkDeckName, setBulkDeckName] = useState("");
  const [bulkLessonId, setBulkLessonId] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const bulkPreview = useMemo(() => parseBulkFlashcards(bulkText), [bulkText]);

  const decks = data.flashcards.reduce<Record<string, AdminData["flashcards"]>>(
    (acc, card) => {
      if (!acc[card.deck_name]) acc[card.deck_name] = [];
      acc[card.deck_name].push(card);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <SectionCard title="Add flashcard">
        <form action={action} className="space-y-4">
          <div>
            <label className={labelClass}>Link to lesson (recommended)</label>
            <select name="lesson_id" className={inputClass}>
              <option value="">No specific lesson</option>
              {data.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.courses?.name} · Lesson {lesson.lesson_number}: {lesson.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Deck name</label>
            <input
              name="deck_name"
              required
              placeholder="e.g. Greetings"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Front text</label>
            <textarea name="front_text" required rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Back text</label>
            <textarea name="back_text" required rows={2} className={inputClass} />
          </div>
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Saving…" : "Add flashcard"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Bulk import flashcards">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Link to lesson (recommended)</label>
            <select
              value={bulkLessonId}
              onChange={(event) => setBulkLessonId(event.target.value)}
              className={inputClass}
            >
              <option value="">No specific lesson</option>
              {data.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.courses?.name} · Lesson {lesson.lesson_number}: {lesson.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Deck name</label>
            <input
              value={bulkDeckName}
              onChange={(event) => setBulkDeckName(event.target.value)}
              className={inputClass}
              placeholder="e.g. Greetings"
            />
          </div>
          <div>
            <label className={labelClass}>Tab-separated rows</label>
            <textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={8}
              className={inputClass}
              placeholder={"Sat Sri Akal\tHello\nDhanvaad\tThank you\nPani\tWater"}
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
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-sm font-semibold text-zinc-700">
                Preview ({bulkPreview.items.length} flashcard
                {bulkPreview.items.length === 1 ? "" : "s"})
              </p>
              <ul className="space-y-2 text-sm">
                {bulkPreview.items.map((item, index) => (
                  <li key={`${item.front_text}-${index}`} className="rounded bg-zinc-50 p-2">
                    <p className="font-medium text-zinc-900">{item.front_text}</p>
                    <p className="text-zinc-600">{item.back_text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form action={bulkAction}>
            <input type="hidden" name="deck_name" value={bulkDeckName} />
            <input type="hidden" name="lesson_id" value={bulkLessonId} />
            <input type="hidden" name="bulk_items" value={JSON.stringify(bulkPreview.items)} />
            <FormMessage state={bulkState} />
            <button
              type="submit"
              disabled={bulkPending || !bulkDeckName || bulkPreview.items.length === 0}
              className={buttonClass}
            >
              {bulkPending ? "Importing…" : "Import flashcards"}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard title={`Flashcards (${data.flashcards.length})`}>
        {Object.keys(decks).length === 0 ? (
          <p className="text-sm text-zinc-500">No flashcards yet.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(decks).map(([deckName, cards]) => (
              <div key={deckName}>
                <h4 className="font-semibold text-violet-700">{deckName}</h4>
                <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
                  {cards.map((card) =>
                    editingId === card.id ? (
                      <FlashcardEditRow
                        key={card.id}
                        card={card}
                        lessons={data.lessons}
                        onCancel={() => setEditingId(null)}
                        onSaved={() => setEditingId(null)}
                      />
                    ) : (
                      <li
                        key={card.id}
                        className="flex items-start justify-between gap-3 p-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-zinc-900">{card.front_text}</p>
                          <p className="mt-1 text-zinc-500">{card.back_text}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(card.id)}
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
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function FlashcardEditRow({
  card,
  lessons,
  onCancel,
  onSaved,
}: {
  card: AdminData["flashcards"][0];
  lessons: AdminData["lessons"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateFlashcard, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="p-3">
      <form action={action} className="space-y-3 rounded bg-zinc-50 p-3">
        <input type="hidden" name="id" value={card.id} />
        <select
          name="lesson_id"
          defaultValue={card.lesson_id ?? ""}
          className={inputClass}
        >
          <option value="">No specific lesson</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.courses?.name} · Lesson {lesson.lesson_number}: {lesson.title}
            </option>
          ))}
        </select>
        <input
          name="deck_name"
          defaultValue={card.deck_name}
          className={inputClass}
          required
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

function parseBulkFlashcards(raw: string) {
  const items: Array<{ front_text: string; back_text: string }> = [];
  const errors: string[] = [];

  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
      const parts = line.split("\t");
      if (parts.length < 2) {
        errors.push(`Line ${index + 1} is missing a tab separator and was skipped.`);
        return;
      }
      const front = parts[0]?.trim();
      const back = parts.slice(1).join("\t").trim();
      if (!front || !back) {
        errors.push(`Line ${index + 1} is incomplete and was skipped.`);
        return;
      }
      items.push({ front_text: front, back_text: back });
    });

  return { items, errors };
}
