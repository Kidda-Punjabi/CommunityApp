"use client";

import { splitPunjabiTiles } from "@/lib/games/types";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateGrammarSentences,
  createGrammarSentence,
  deleteGrammarSentence,
  updateGrammarSentence,
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

function tilesToText(tiles: string[]) {
  return tiles.join(", ");
}

function textToTiles(text: string) {
  return text
    .split(",")
    .map((tile) => tile.trim())
    .filter(Boolean);
}

function WordTilesEditor({
  punjabiSentence,
  tilesText,
  onPunjabiChange,
  onTilesChange,
}: {
  punjabiSentence: string;
  tilesText: string;
  onPunjabiChange: (value: string) => void;
  onTilesChange: (value: string) => void;
}) {
  return (
    <>
      <div>
        <label className={labelClass}>Punjabi sentence</label>
        <input
          name="punjabi_sentence"
          required
          value={punjabiSentence}
          onChange={(event) => {
            const value = event.target.value;
            onPunjabiChange(value);
            onTilesChange(tilesToText(splitPunjabiTiles(value)));
          }}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Word tiles (comma-separated)</label>
        <input
          value={tilesText}
          onChange={(event) => onTilesChange(event.target.value)}
          className={inputClass}
          placeholder="Auto-split from sentence; edit if needed"
        />
        {tilesText && (
          <div className="mt-2 flex flex-wrap gap-2">
            {textToTiles(tilesText).map((tile, index) => (
              <span
                key={`${tile}-${index}`}
                className="rounded-lg bg-violet-50 px-2 py-1 text-sm text-violet-800"
              >
                {tile}
              </span>
            ))}
          </div>
        )}
      </div>
      <input type="hidden" name="word_tiles" value={JSON.stringify(textToTiles(tilesText))} />
    </>
  );
}

function SharedSentenceFields({ courses }: { courses: AdminData["courses"] }) {
  return (
    <>
      <div>
        <label className={labelClass}>English translation</label>
        <input name="english_translation" required className={inputClass} />
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
      <div>
        <label className={labelClass}>Topic tags (comma-separated)</label>
        <input name="topic_tags" className={inputClass} placeholder="greetings, basics" />
      </div>
    </>
  );
}

export function SentenceBuilderTab({ data }: { data: AdminData }) {
  const [createState, createAction, createPending] = useActionState(
    createGrammarSentence,
    initialState
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateGrammarSentences,
    initialState
  );
  const [punjabiSentence, setPunjabiSentence] = useState("");
  const [tilesText, setTilesText] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <SectionCard title="Add sentence">
        <form action={createAction} className="space-y-4">
          <WordTilesEditor
            punjabiSentence={punjabiSentence}
            tilesText={tilesText}
            onPunjabiChange={setPunjabiSentence}
            onTilesChange={setTilesText}
          />
          <SharedSentenceFields courses={data.courses} />
          <FormMessage state={createState} />
          <button type="submit" disabled={createPending} className={buttonClass}>
            {createPending ? "Saving…" : "Add sentence"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Bulk import sentences">
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
            <label className={labelClass}>Paste sentences</label>
            <textarea
              name="bulk_text"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={12}
              className={inputClass}
              placeholder={
                "PUNJABI: ਮੈਂ ਸਕੂਲ ਜਾਂਦਾ ਹਾਂ\nENGLISH: I go to school\nDIFFICULTY: 1\nTAGS: daily, verbs\n\nPUNJABI: ..."
              }
            />
          </div>
          <FormMessage state={bulkState} />
          <button
            type="submit"
            disabled={bulkPending || !bulkText.trim()}
            className={buttonClass}
          >
            {bulkPending ? "Importing…" : "Import sentences"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Sentences (${data.grammarSentences.length})`}>
        {data.grammarSentences.length === 0 ? (
          <p className="text-sm text-zinc-500">No sentences yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {data.grammarSentences.map((sentence) =>
              editingId === sentence.id ? (
                <SentenceEditRow
                  key={sentence.id}
                  sentence={sentence}
                  courses={data.courses}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => setEditingId(null)}
                />
              ) : (
                <li
                  key={sentence.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-zinc-900">{sentence.punjabi_sentence}</p>
                    <p className="mt-1 text-sm text-zinc-600">{sentence.english_translation}</p>
                    <p className="mt-2 flex flex-wrap gap-1">
                      {sentence.word_tiles.map((tile, index) => (
                        <span
                          key={`${tile}-${index}`}
                          className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700"
                        >
                          {tile}
                        </span>
                      ))}
                    </p>
                    <p className="mt-2 text-xs text-zinc-400">
                      Difficulty {sentence.difficulty}
                      {sentence.topic_tags.length > 0 &&
                        ` · Tags: ${sentence.topic_tags.join(", ")}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(sentence.id)}
                      className={secondaryButtonClass}
                    >
                      Edit
                    </button>
                    <DeleteSentenceButton id={sentence.id} />
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

function SentenceEditRow({
  sentence,
  courses,
  onCancel,
  onSaved,
}: {
  sentence: AdminData["grammarSentences"][0];
  courses: AdminData["courses"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateGrammarSentence, initialState);
  const [punjabiSentence, setPunjabiSentence] = useState(sentence.punjabi_sentence);
  const [tilesText, setTilesText] = useState(tilesToText(sentence.word_tiles));

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="py-4">
      <form action={action} className="space-y-3 rounded-lg bg-zinc-50 p-4">
        <input type="hidden" name="id" value={sentence.id} />
        <WordTilesEditor
          punjabiSentence={punjabiSentence}
          tilesText={tilesText}
          onPunjabiChange={setPunjabiSentence}
          onTilesChange={setTilesText}
        />
        <div>
          <label className={labelClass}>English translation</label>
          <input
            name="english_translation"
            defaultValue={sentence.english_translation}
            required
            className={inputClass}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Difficulty (1–5)</label>
            <input
              name="difficulty"
              type="number"
              min={1}
              max={5}
              defaultValue={sentence.difficulty}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Course (optional)</label>
            <select
              name="course_id"
              defaultValue={sentence.course_id ?? ""}
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
            defaultValue={sentence.topic_tags.join(", ")}
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

function DeleteSentenceButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this sentence?")) return;
        setPending(true);
        const formData = new FormData();
        formData.set("id", id);
        await deleteGrammarSentence({}, formData);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
