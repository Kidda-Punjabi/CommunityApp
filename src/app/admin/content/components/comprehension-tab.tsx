"use client";

import { AudioPanel, AudioStatusBadge } from "@/app/admin/content/components/audio-panel";
import {
  createComprehensionQuestion,
  createComprehensionScript,
  createComprehensionSentence,
  deleteComprehensionQuestion,
  deleteComprehensionScript,
  deleteComprehensionSentence,
  loadComprehensionAdminData,
  updateComprehensionScript,
  updateComprehensionSentence,
  type AdminComprehensionData,
  type AdminComprehensionQuestion,
  type AdminComprehensionScript,
  type AdminComprehensionSentence,
  type ComprehensionActionResult,
} from "@/app/admin/content/comprehension-actions";
import type { AudioAssetStatus } from "@/lib/audio/types";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  FormMessage,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initial: ComprehensionActionResult = {};

function previewText(text: string, max = 48): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function scriptAudioProgress(
  sentences: AdminComprehensionSentence[],
  audioStatusBySentenceId: Record<string, AudioAssetStatus>
): string {
  let approved = 0;
  let pending = 0;
  let needs = 0;
  let none = 0;

  for (const sentence of sentences) {
    const status = audioStatusBySentenceId[sentence.id] ?? "none";
    if (status === "approved") approved += 1;
    else if (status === "pending_review") pending += 1;
    else if (status === "needs_changes") needs += 1;
    else none += 1;
  }

  const parts: string[] = [];
  if (approved) parts.push(`${approved} approved`);
  if (pending) parts.push(`${pending} pending`);
  if (needs) parts.push(`${needs} needs changes`);
  if (none) parts.push(`${none} not generated`);
  return parts.join(" · ") || "No sentences";
}

export function ComprehensionTab() {
  const [data, setData] = useState<AdminComprehensionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  const [expandedSentenceId, setExpandedSentenceId] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [showNewScript, setShowNewScript] = useState(false);

  async function refresh() {
    setLoading(true);
    const result = await loadComprehensionAdminData();
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  function toggleScript(scriptId: string) {
    setExpandedScriptId((current) => (current === scriptId ? null : scriptId));
    setExpandedSentenceId(null);
    setExpandedQuestionId(null);
  }

  function toggleSentence(sentenceId: string) {
    setExpandedSentenceId((current) => (current === sentenceId ? null : sentenceId));
  }

  function toggleQuestion(questionId: string) {
    setExpandedQuestionId((current) => (current === questionId ? null : questionId));
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading comprehension content…</p>;
  }

  if (data?.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        {data.error}
        {data.error.includes("does not exist") ? (
          <>
            {" "}
            Run <code className="text-xs">supabase/comprehension-practice.sql</code> first.
          </>
        ) : null}
      </p>
    );
  }

  const audioStatusBySentenceId = data?.audioStatusBySentenceId ?? {};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Scripts, sentences, and per-sentence audio — expand one item at a time to edit and review.
        </p>
        <button
          type="button"
          onClick={() => setShowNewScript((open) => !open)}
          className={secondaryButtonClass}
        >
          {showNewScript ? "Cancel" : "+ New script"}
        </button>
      </div>

      {showNewScript ? (
        <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/40 p-5">
          <h3 className="font-semibold text-zinc-900">New comprehension script</h3>
          <CreateScriptForm
            onSuccess={() => {
              setShowNewScript(false);
              void refresh();
            }}
          />
        </div>
      ) : null}

      {(data?.scripts ?? []).length === 0 ? (
        <p className="text-sm text-zinc-500">No scripts yet — add one above.</p>
      ) : (
        <ul className="space-y-2">
          {(data?.scripts ?? []).map((script) => {
            const sentences = data?.sentencesByScript[script.id] ?? [];
            const questions = data?.questionsByScript[script.id] ?? [];
            const expanded = expandedScriptId === script.id;

            return (
              <ScriptAccordion
                key={script.id}
                script={script}
                sentences={sentences}
                questions={questions}
                audioStatusBySentenceId={audioStatusBySentenceId}
                expanded={expanded}
                expandedSentenceId={expandedSentenceId}
                expandedQuestionId={expandedQuestionId}
                onToggle={() => toggleScript(script.id)}
                onToggleSentence={toggleSentence}
                onToggleQuestion={toggleQuestion}
                onUpdated={() => void refresh()}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CreateScriptForm({ onSuccess }: { onSuccess: () => void }) {
  const [state, action, pending] = useActionState(createComprehensionScript, initial);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" rows={2} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Difficulty (1–5)</label>
          <input name="difficulty" type="number" min={1} max={5} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Display order</label>
          <input name="display_order" type="number" defaultValue={0} className={inputClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input name="active" type="checkbox" defaultChecked className="rounded border-zinc-300" />
        Active
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Create script"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

function ScriptAccordion({
  script,
  sentences,
  questions,
  audioStatusBySentenceId,
  expanded,
  expandedSentenceId,
  expandedQuestionId,
  onToggle,
  onToggleSentence,
  onToggleQuestion,
  onUpdated,
}: {
  script: AdminComprehensionScript;
  sentences: AdminComprehensionSentence[];
  questions: AdminComprehensionQuestion[];
  audioStatusBySentenceId: Record<string, AudioAssetStatus>;
  expanded: boolean;
  expandedSentenceId: string | null;
  expandedQuestionId: string | null;
  onToggle: () => void;
  onToggleSentence: (id: string) => void;
  onToggleQuestion: (id: string) => void;
  onUpdated: () => void;
}) {
  const progress = scriptAudioProgress(sentences, audioStatusBySentenceId);

  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50"
      >
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{script.title}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {sentences.length} sentence{sentences.length === 1 ? "" : "s"} · {progress}
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 px-4 pb-5 pt-2">
          <ScriptEditorForm script={script} onUpdated={onUpdated} />

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-semibold text-zinc-900">Sentences</h4>
            </div>
            <p className="text-sm text-zinc-500">
              Expand a sentence to edit text and generate, listen, and approve audio inline.
            </p>

            {sentences.length === 0 ? (
              <p className="text-sm text-zinc-500">No sentences yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {sentences.map((sentence) => (
                  <SentenceAccordionRow
                    key={sentence.id}
                    sentence={sentence}
                    audioStatus={audioStatusBySentenceId[sentence.id] ?? "none"}
                    expanded={expandedSentenceId === sentence.id}
                    onToggle={() => onToggleSentence(sentence.id)}
                    onUpdated={onUpdated}
                  />
                ))}
              </ul>
            )}

            <AddSentenceForm scriptId={script.id} nextOrder={sentences.length + 1} onSuccess={onUpdated} />
          </div>

          <div className="mt-8 space-y-2">
            <h4 className="font-semibold text-zinc-900">Questions</h4>
            {questions.length === 0 ? (
              <p className="text-sm text-zinc-500">No questions yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {questions.map((question) => (
                  <QuestionAccordionRow
                    key={question.id}
                    question={question}
                    expanded={expandedQuestionId === question.id}
                    onToggle={() => onToggleQuestion(question.id)}
                    onUpdated={onUpdated}
                  />
                ))}
              </ul>
            )}
            <AddQuestionForm
              scriptId={script.id}
              sentences={sentences}
              nextOrder={questions.length}
              onSuccess={onUpdated}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ScriptEditorForm({
  script,
  onUpdated,
}: {
  script: AdminComprehensionScript;
  onUpdated: () => void;
}) {
  const [state, action, pending] = useActionState(updateComprehensionScript, initial);
  const [deletePending, startDelete] = useTransition();

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  return (
    <form action={action} className="space-y-3 rounded-xl bg-zinc-50 p-4">
      <input type="hidden" name="id" value={script.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-700">Script settings</p>
        <button
          type="button"
          disabled={deletePending}
          onClick={() =>
            startDelete(async () => {
              if (!confirm("Delete this script and all its sentences/questions?")) return;
              await deleteComprehensionScript(script.id);
              onUpdated();
            })
          }
          className={dangerButtonClass}
        >
          Delete script
        </button>
      </div>
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required defaultValue={script.title} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={script.description ?? ""}
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
            defaultValue={script.difficulty ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Display order</label>
          <input
            name="display_order"
            type="number"
            defaultValue={script.display_order}
            className={inputClass}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          name="active"
          type="checkbox"
          defaultChecked={script.active}
          className="rounded border-zinc-300"
        />
        Active
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending ? "Saving…" : "Save script"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

function SentenceAccordionRow({
  sentence,
  audioStatus,
  expanded,
  onToggle,
  onUpdated,
}: {
  sentence: AdminComprehensionSentence;
  audioStatus: AudioAssetStatus;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50"
      >
        <span className="w-8 shrink-0 text-sm font-semibold text-zinc-500">
          {sentence.sequence_order}.
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-900" dir="auto">
          {previewText(sentence.gurmukhi_text)}
        </span>
        <AudioStatusBadge status={audioStatus} />
        <span className="shrink-0 text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-4">
          <SentenceEditor sentence={sentence} onUpdated={onUpdated} />
        </div>
      ) : null}
    </li>
  );
}

function SentenceEditor({
  sentence,
  onUpdated,
}: {
  sentence: AdminComprehensionSentence;
  onUpdated: () => void;
}) {
  const [state, action, pending] = useActionState(updateComprehensionSentence, initial);
  const [deletePending, startDelete] = useTransition();
  const [gurmukhi, setGurmukhi] = useState(sentence.gurmukhi_text);

  useEffect(() => {
    setGurmukhi(sentence.gurmukhi_text);
  }, [sentence.gurmukhi_text]);

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={sentence.id} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800">Sentence {sentence.sequence_order}</p>
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDelete(async () => {
                if (!confirm("Delete this sentence?")) return;
                await deleteComprehensionSentence(sentence.id);
                onUpdated();
              })
            }
            className={dangerButtonClass}
          >
            Delete
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Order</label>
            <input
              name="sequence_order"
              type="number"
              min={1}
              defaultValue={sentence.sequence_order}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Gurmukhi</label>
          <textarea
            name="gurmukhi_text"
            required
            rows={2}
            dir="auto"
            value={gurmukhi}
            onChange={(event) => setGurmukhi(event.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Romanised</label>
          <input
            name="romanised_text"
            required
            defaultValue={sentence.romanised_text}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>English (optional)</label>
          <input
            name="english_translation"
            defaultValue={sentence.english_translation ?? ""}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          Save sentence
        </button>
        <FormMessage state={state} />
      </form>

      <AudioPanel
        contentType="comprehension_sentence"
        contentId={sentence.id}
        defaultScript={gurmukhi}
        scriptHint="Gurmukhi text for this sentence — used for listening mode playback."
        onUpdated={onUpdated}
      />
    </div>
  );
}

function QuestionAccordionRow({
  question,
  expanded,
  onToggle,
  onUpdated,
}: {
  question: AdminComprehensionQuestion;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
}) {
  const [deletePending, startDelete] = useTransition();

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">
          {previewText(question.question_text, 64)}
        </span>
        <span className="shrink-0 text-xs text-zinc-500">
          Correct: {question.correct_option.toUpperCase()}
        </span>
        <span className="shrink-0 text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-3 text-sm">
          <p className="font-medium text-zinc-900">{question.question_text}</p>
          <p className="mt-2 text-zinc-600">
            A: {question.option_a} · B: {question.option_b} · C: {question.option_c} · D:{" "}
            {question.option_d}
          </p>
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDelete(async () => {
                if (!confirm("Delete this question?")) return;
                await deleteComprehensionQuestion(question.id);
                onUpdated();
              })
            }
            className={`${dangerButtonClass} mt-3`}
          >
            Delete question
          </button>
        </div>
      ) : null}
    </li>
  );
}

function AddSentenceForm({
  scriptId,
  nextOrder,
  onSuccess,
}: {
  scriptId: string;
  nextOrder: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createComprehensionSentence, initial);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <details className="rounded-xl border border-dashed border-zinc-300 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">+ Add sentence</summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="script_id" value={scriptId} />
        <input type="hidden" name="sequence_order" value={nextOrder} />
        <div>
          <label className={labelClass}>Gurmukhi</label>
          <textarea name="gurmukhi_text" required rows={2} dir="auto" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Romanised</label>
          <input name="romanised_text" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>English (optional)</label>
          <input name="english_translation" className={inputClass} />
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add sentence
        </button>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

function AddQuestionForm({
  scriptId,
  sentences,
  nextOrder,
  onSuccess,
}: {
  scriptId: string;
  sentences: AdminComprehensionSentence[];
  nextOrder: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createComprehensionQuestion, initial);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <details className="rounded-xl border border-dashed border-zinc-300 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">+ Add question</summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="script_id" value={scriptId} />
        <input type="hidden" name="sequence_order" value={nextOrder} />
        <div>
          <label className={labelClass}>Question</label>
          <input name="question_text" required className={inputClass} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Option A</label>
            <input name="option_a" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Option B</label>
            <input name="option_b" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Option C</label>
            <input name="option_c" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Option D</label>
            <input name="option_d" required className={inputClass} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Correct option</label>
            <select name="correct_option" defaultValue="a" className={inputClass}>
              <option value="a">A</option>
              <option value="b">B</option>
              <option value="c">C</option>
              <option value="d">D</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Related sentence (optional)</label>
            <select name="related_sentence_id" className={inputClass} defaultValue="">
              <option value="">None</option>
              {sentences.map((sentence) => (
                <option key={sentence.id} value={sentence.id}>
                  {sentence.sequence_order}. {sentence.gurmukhi_text.slice(0, 40)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add question
        </button>
        <FormMessage state={state} />
      </form>
    </details>
  );
}
