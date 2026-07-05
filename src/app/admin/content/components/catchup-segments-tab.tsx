"use client";

import { AudioPanel } from "@/app/admin/content/components/audio-panel";
import {
  deleteCatchupBeatAction,
  deleteCatchupSegmentAction,
  loadCatchupSegmentsAction,
  saveCatchupBeatAction,
  saveCatchupSegmentAction,
  type ActionResult,
  type CatchupBeatAdmin,
  type CatchupSegmentAdmin,
} from "@/app/admin/content/catchup-actions";
import type { AdminData } from "@/app/admin/content/types";
import Link from "next/link";
import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CatchupTeachingVisualEditor } from "@/app/admin/content/components/catchup-teaching-visual-editor";
import { defaultTeachingVisualConfig } from "@/lib/catchup/teaching-visuals/defaults";
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

const ACTIVITY_TYPES = [
  { value: "none", label: "None" },
  { value: "quiz", label: "Quiz" },
  { value: "flashcard_set", label: "Flashcard set" },
  { value: "game", label: "Game" },
  { value: "homework", label: "Homework" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "translate", label: "Translate" },
  { value: "record_practice", label: "Record practice" },
  { value: "external_link", label: "External link" },
] as const;

export function CatchupSegmentsTab({ data }: { data: AdminData }) {
  const [lessonId, setLessonId] = useState("");
  const [segments, setSegments] = useState<CatchupSegmentAdmin[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, startLoad] = useTransition();

  const lessons = useMemo(
    () =>
      [...data.lessons].sort((a, b) => {
        const courseA = a.courses?.name ?? "";
        const courseB = b.courses?.name ?? "";
        if (courseA !== courseB) return courseA.localeCompare(courseB);
        return a.lesson_number - b.lesson_number;
      }),
    [data.lessons]
  );

  const selectedSegment =
    segments.find((segment) => segment.id === selectedSegmentId) ?? null;

  const reloadSegments = useCallback(() => {
    if (!lessonId) {
      setSegments([]);
      return;
    }

    startLoad(async () => {
      setLoadError("");
      const result = await loadCatchupSegmentsAction(lessonId);
      if (result.error) {
        setLoadError(result.error);
        setSegments([]);
        return;
      }
      setSegments(result.segments ?? []);
      setSelectedSegmentId((current) => {
        if (current && result.segments?.some((segment) => segment.id === current)) {
          return current;
        }
        return result.segments?.[0]?.id ?? null;
      });
    });
  }, [lessonId]);

  useEffect(() => {
    reloadSegments();
  }, [reloadSegments]);

  const lessonQuizzes = useMemo(
    () => data.quizzes.filter((quiz) => quiz.lesson_id === lessonId),
    [data.quizzes, lessonId]
  );

  const lessonDecks = useMemo(() => {
    const deckIds = new Set(
      data.setCourseLinks
        .filter((link) => link.lesson_id === lessonId)
        .map((link) => link.deck_id)
    );
    return data.flashcardSets.filter((set) => deckIds.has(set.id));
  }, [data.setCourseLinks, data.flashcardSets, lessonId]);

  return (
    <div className="space-y-6">
      <SectionCard title="Catch-up lesson segments">
        <p className="mb-4 text-sm text-zinc-600">
          Build ordered segments and beats for the self-paced catch-up player. Each segment uses a
          code-built Lucide visual (no slide images). Narration beats use the TTS review queue;
          phrase beats reuse approved flashcard or grammar sentence audio.
        </p>
        <div>
          <label className={labelClass}>Lesson</label>
          <select
            value={lessonId}
            onChange={(event) => {
              setLessonId(event.target.value);
              setSelectedSegmentId(null);
            }}
            className={inputClass}
          >
            <option value="">Select a lesson…</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.courses?.name ?? "Course"} · L{lesson.lesson_number}: {lesson.title}
              </option>
            ))}
          </select>
        </div>
        {lessonId ? (
          <p className="mt-3 text-sm text-zinc-500">
            Preview player:{" "}
            <Link href={`/catchup/${lessonId}`} className="font-medium text-violet-600 hover:text-violet-500">
              /catchup/{lessonId.slice(0, 8)}…
            </Link>
          </p>
        ) : null}
        {loadError ? <p className="mt-3 text-sm text-red-600">{loadError}</p> : null}
        {loading ? <p className="mt-3 text-sm text-zinc-500">Loading segments…</p> : null}
      </SectionCard>

      {lessonId ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <SegmentListPanel
            lessonId={lessonId}
            segments={segments}
            selectedSegmentId={selectedSegmentId}
            onSelect={setSelectedSegmentId}
            onSaved={reloadSegments}
          />
          {selectedSegment ? (
            <SegmentDetailPanel
              segment={selectedSegment}
              lessonQuizzes={lessonQuizzes}
              lessonDecks={lessonDecks}
              flashcards={data.flashcards}
              grammarSentences={data.grammarSentences}
              onSaved={reloadSegments}
            />
          ) : (
            <SectionCard title="Segment editor">
              <p className="text-sm text-zinc-500">Add or select a segment to edit beats and audio.</p>
            </SectionCard>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SegmentListPanel({
  lessonId,
  segments,
  selectedSegmentId,
  onSelect,
  onSaved,
}: {
  lessonId: string;
  segments: CatchupSegmentAdmin[];
  selectedSegmentId: string | null;
  onSelect: (id: string) => void;
  onSaved: () => void;
}) {
  const [createState, createAction, createPending] = useActionState(
    saveCatchupSegmentAction,
    initialState
  );
  const nextNumber = segments.reduce((max, segment) => Math.max(max, segment.segmentNumber), 0) + 1;

  useEffect(() => {
    if (createState.success) onSaved();
  }, [createState.success, onSaved]);

  return (
    <SectionCard title="Segments">
      <form action={createAction} className="mb-4 space-y-3 border-b border-zinc-100 pb-4">
        <input type="hidden" name="lesson_id" value={lessonId} />
        <input type="hidden" name="segment_number" value={nextNumber} />
        <input type="hidden" name="sort_order" value={nextNumber} />
        <div>
          <label className={labelClass}>New segment title</label>
          <input name="title" required placeholder="e.g. Warming up" className={inputClass} />
        </div>
        <input type="hidden" name="teaching_visual_type" value="icon_hero" />
        <input
          type="hidden"
          name="teaching_visual_config"
          value={JSON.stringify(defaultTeachingVisualConfig("icon_hero"))}
        />
        <button type="submit" disabled={createPending} className={buttonClass}>
          Add segment
        </button>
        <FormMessage state={createState} />
      </form>

      <ul className="space-y-2">
        {segments.map((segment) => (
          <li key={segment.id}>
            <button
              type="button"
              onClick={() => onSelect(segment.id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                selectedSegmentId === segment.id
                  ? "border-violet-300 bg-violet-50"
                  : "border-zinc-200 bg-white hover:border-violet-200"
              }`}
            >
              <span className="font-medium text-zinc-900">
                {segment.segmentNumber}. {segment.title}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {segment.beats.length} beat{segment.beats.length === 1 ? "" : "s"}
                {segment.activityType !== "none" ? ` · ${segment.activityType}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {segments.length === 0 ? (
        <p className="text-sm text-zinc-500">No segments yet for this lesson.</p>
      ) : null}
    </SectionCard>
  );
}

function SegmentDetailPanel({
  segment,
  lessonQuizzes,
  lessonDecks,
  flashcards,
  grammarSentences,
  onSaved,
}: {
  segment: CatchupSegmentAdmin;
  lessonQuizzes: AdminData["quizzes"];
  lessonDecks: AdminData["flashcardSets"];
  flashcards: AdminData["flashcards"];
  grammarSentences: AdminData["grammarSentences"];
  onSaved: () => void;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveCatchupSegmentAction,
    initialState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCatchupSegmentAction,
    initialState
  );

  useEffect(() => {
    if (saveState.success || deleteState.success) onSaved();
  }, [saveState.success, deleteState.success, onSaved]);

  return (
    <div className="space-y-6">
      <SectionCard title={`Segment ${segment.segmentNumber}: ${segment.title}`}>
        <form action={saveAction} className="space-y-4">
          <input type="hidden" name="id" value={segment.id} />
          <input type="hidden" name="lesson_id" value={segment.lessonId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Segment number</label>
              <input
                name="segment_number"
                type="number"
                min={1}
                defaultValue={segment.segmentNumber}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Sort order</label>
              <input
                name="sort_order"
                type="number"
                min={1}
                defaultValue={segment.sortOrder}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input name="title" required defaultValue={segment.title} className={inputClass} />
          </div>
          <CatchupTeachingVisualEditor
            initialType={segment.teachingVisualType}
            initialConfig={segment.teachingVisualConfig}
          />
          <div>
            <label className={labelClass}>Activity type</label>
            <select name="activity_type" defaultValue={segment.activityType} className={inputClass}>
              {ACTIVITY_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Activity reference</label>
            {segment.activityType === "quiz" ? (
              <select name="activity_ref_id" defaultValue={segment.activityRefId ?? ""} className={inputClass}>
                <option value="">Select quiz…</option>
                {lessonQuizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
            ) : segment.activityType === "flashcard_set" || segment.activityType === "game" ? (
              <select name="activity_ref_id" defaultValue={segment.activityRefId ?? ""} className={inputClass}>
                <option value="">Select deck…</option>
                {lessonDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name="activity_ref_id"
                defaultValue={segment.activityRefId ?? ""}
                placeholder="UUID or URL"
                className={inputClass}
              />
            )}
          </div>
          <div>
            <label className={labelClass}>Activity instructions</label>
            <textarea
              name="activity_instructions"
              rows={3}
              defaultValue={segment.activityInstructions ?? ""}
              className={inputClass}
            />
          </div>
          <button type="submit" disabled={savePending} className={buttonClass}>
            Save segment
          </button>
          <FormMessage state={saveState} />
        </form>

        <form action={deleteAction} className="mt-4 border-t border-zinc-100 pt-4">
          <input type="hidden" name="id" value={segment.id} />
          <button type="submit" disabled={deletePending} className={dangerButtonClass}>
            Delete segment
          </button>
          <FormMessage state={deleteState} />
        </form>
      </SectionCard>

      <BeatsPanel
        segment={segment}
        flashcards={flashcards}
        grammarSentences={grammarSentences}
        onSaved={onSaved}
      />
    </div>
  );
}

function BeatsPanel({
  segment,
  flashcards,
  grammarSentences,
  onSaved,
}: {
  segment: CatchupSegmentAdmin;
  flashcards: AdminData["flashcards"];
  grammarSentences: AdminData["grammarSentences"];
  onSaved: () => void;
}) {
  const nextBeatNumber =
    segment.beats.reduce((max, beat) => Math.max(max, beat.beatNumber), 0) + 1;

  return (
    <SectionCard title="Beats">
      <AddBeatForm
        segmentId={segment.id}
        nextBeatNumber={nextBeatNumber}
        flashcards={flashcards}
        grammarSentences={grammarSentences}
        onSaved={onSaved}
      />
      <div className="mt-6 space-y-4">
        {segment.beats.map((beat) => (
          <BeatEditor
            key={beat.id}
            beat={beat}
            flashcards={flashcards}
            grammarSentences={grammarSentences}
            onSaved={onSaved}
          />
        ))}
      </div>
      {segment.beats.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No beats yet — add narration or phrase beats above.</p>
      ) : null}
    </SectionCard>
  );
}

function AddBeatForm({
  segmentId,
  nextBeatNumber,
  flashcards,
  grammarSentences,
  onSaved,
}: {
  segmentId: string;
  nextBeatNumber: number;
  flashcards: AdminData["flashcards"];
  grammarSentences: AdminData["grammarSentences"];
  onSaved: () => void;
}) {
  const [beatType, setBeatType] = useState<"narration" | "phrase_reference">("narration");
  const [saveState, saveAction, savePending] = useActionState(saveCatchupBeatAction, initialState);

  useEffect(() => {
    if (saveState.success) onSaved();
  }, [saveState.success, onSaved]);

  return (
    <form action={saveAction} className="space-y-3 rounded-xl border border-dashed border-zinc-200 p-4">
      <input type="hidden" name="segment_id" value={segmentId} />
      <input type="hidden" name="beat_number" value={nextBeatNumber} />
      <p className="text-sm font-medium text-zinc-900">Add beat #{nextBeatNumber}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setBeatType("narration")}
          className={beatType === "narration" ? buttonClass : secondaryButtonClass}
        >
          Narration
        </button>
        <button
          type="button"
          onClick={() => setBeatType("phrase_reference")}
          className={beatType === "phrase_reference" ? buttonClass : secondaryButtonClass}
        >
          Phrase reference
        </button>
      </div>
      <input type="hidden" name="beat_type" value={beatType} />
      {beatType === "narration" ? (
        <textarea
          name="script_text"
          rows={3}
          required
          placeholder="English narration script for TTS"
          className={inputClass}
        />
      ) : (
        <PhraseSourcePicker
          flashcards={flashcards}
          grammarSentences={grammarSentences}
        />
      )}
      <button type="submit" disabled={savePending} className={buttonClass}>
        Add beat
      </button>
      <FormMessage state={saveState} />
    </form>
  );
}

function BeatEditor({
  beat,
  flashcards,
  grammarSentences,
  onSaved,
}: {
  beat: CatchupBeatAdmin;
  flashcards: AdminData["flashcards"];
  grammarSentences: AdminData["grammarSentences"];
  onSaved: () => void;
}) {
  const [saveState, saveAction, savePending] = useActionState(saveCatchupBeatAction, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCatchupBeatAction,
    initialState
  );

  useEffect(() => {
    if (saveState.success || deleteState.success) onSaved();
  }, [saveState.success, deleteState.success, onSaved]);

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <p className="text-sm font-semibold text-zinc-900">
        Beat {beat.beatNumber} · {beat.beatType === "narration" ? "Narration" : "Phrase"}
      </p>
      <form action={saveAction} className="mt-3 space-y-3">
        <input type="hidden" name="id" value={beat.id} />
        <input type="hidden" name="segment_id" value={beat.segmentId} />
        <input type="hidden" name="beat_number" value={beat.beatNumber} />
        <input type="hidden" name="beat_type" value={beat.beatType} />
        {beat.beatType === "narration" ? (
          <textarea
            name="script_text"
            rows={3}
            required
            defaultValue={beat.scriptText ?? ""}
            className={inputClass}
          />
        ) : (
          <PhraseSourcePicker
            flashcards={flashcards}
            grammarSentences={grammarSentences}
            defaultContentType={beat.sourceContentType}
            defaultContentId={beat.sourceContentId}
          />
        )}
        <button type="submit" disabled={savePending} className={secondaryButtonClass}>
          Update beat
        </button>
        <FormMessage state={saveState} />
      </form>

      {beat.beatType === "narration" ? (
        <div className="mt-4 border-t border-zinc-100 pt-4">
          <AudioPanel
            contentType="lesson_segment_beat"
            contentId={beat.id}
            defaultScript={beat.scriptText}
            scriptHint="English narration script — generate and approve via the standard review queue."
          />
        </div>
      ) : null}

      <form action={deleteAction} className="mt-3">
        <input type="hidden" name="id" value={beat.id} />
        <button type="submit" disabled={deletePending} className={dangerButtonClass}>
          Delete beat
        </button>
        <FormMessage state={deleteState} />
      </form>
    </div>
  );
}

function PhraseSourcePicker({
  flashcards,
  grammarSentences,
  defaultContentType,
  defaultContentId,
}: {
  flashcards: AdminData["flashcards"];
  grammarSentences: AdminData["grammarSentences"];
  defaultContentType?: string | null;
  defaultContentId?: string | null;
}) {
  const [sourceType, setSourceType] = useState<"flashcard" | "grammar_sentence">(
    defaultContentType === "grammar_sentence" ? "grammar_sentence" : "flashcard"
  );
  const [query, setQuery] = useState("");

  const flashcardOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return flashcards
      .filter((card) => {
        if (!normalized) return true;
        return (
          card.front_text.toLowerCase().includes(normalized) ||
          card.back_text.toLowerCase().includes(normalized) ||
          card.deck_name.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 40);
  }, [flashcards, query]);

  const grammarOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return grammarSentences
      .filter((sentence) => {
        if (!normalized) return true;
        return (
          sentence.english_translation.toLowerCase().includes(normalized) ||
          sentence.punjabi_sentence.toLowerCase().includes(normalized)
        );
      })
      .slice(0, 40);
  }, [grammarSentences, query]);

  return (
    <div className="space-y-2">
      <select
        value={sourceType}
        onChange={(event) =>
          setSourceType(event.target.value as "flashcard" | "grammar_sentence")
        }
        className={inputClass}
      >
        <option value="flashcard">Flashcard</option>
        <option value="grammar_sentence">Grammar sentence</option>
      </select>
      <input type="hidden" name="source_content_type" value={sourceType} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search phrases…"
        className={inputClass}
      />
      <select
        name="source_content_id"
        defaultValue={defaultContentId ?? ""}
        required
        className={inputClass}
      >
        <option value="">Select source…</option>
        {sourceType === "flashcard"
          ? flashcardOptions.map((card) => (
              <option key={card.id} value={card.id}>
                {card.front_text} / {card.back_text} ({card.deck_name})
              </option>
            ))
          : grammarOptions.map((sentence) => (
              <option key={sentence.id} value={sentence.id}>
                {sentence.english_translation} · {sentence.punjabi_sentence}
              </option>
            ))}
      </select>
    </div>
  );
}
