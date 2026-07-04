"use client";

import { AudioPanel } from "@/app/admin/content/components/audio-panel";
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
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initial: ComprehensionActionResult = {};

export function ComprehensionTab() {
  const [data, setData] = useState<AdminComprehensionData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    const result = await loadComprehensionAdminData();
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

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

  return (
    <div className="space-y-8">
      <SectionCard title="Add comprehension script">
        <CreateScriptForm onSuccess={() => void refresh()} />
      </SectionCard>

      {(data?.scripts ?? []).length === 0 ? (
        <p className="text-sm text-zinc-500">No scripts yet.</p>
      ) : (
        <ul className="space-y-6">
          {(data?.scripts ?? []).map((script) => (
            <ScriptEditor
              key={script.id}
              script={script}
              sentences={data?.sentencesByScript[script.id] ?? []}
              questions={data?.questionsByScript[script.id] ?? []}
              onUpdated={() => void refresh()}
            />
          ))}
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
    <form action={action} className="space-y-4">
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

function ScriptEditor({
  script,
  sentences,
  questions,
  onUpdated,
}: {
  script: AdminComprehensionScript;
  sentences: AdminComprehensionSentence[];
  questions: AdminComprehensionQuestion[];
  onUpdated: () => void;
}) {
  const [state, action, pending] = useActionState(updateComprehensionScript, initial);
  const [deletePending, startDelete] = useTransition();

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  return (
    <li className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <form action={action} className="space-y-4">
        <input type="hidden" name="id" value={script.id} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-zinc-900">Script</h3>
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDelete(async () => {
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
        <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="mt-8 space-y-4">
        <h4 className="font-semibold text-zinc-900">Listening passage sentences</h4>
        <p className="text-sm text-zinc-500">
          Each sentence needs approved audio for listening mode. Generate audio per sentence below
          (Gurmukhi is voiced — questions stay text-only).
        </p>

        {sentences.map((sentence) => (
          <SentenceEditor key={sentence.id} sentence={sentence} onUpdated={onUpdated} />
        ))}

        <AddSentenceForm scriptId={script.id} nextOrder={sentences.length + 1} onSuccess={onUpdated} />
      </div>

      <div className="mt-8 space-y-4">
        <h4 className="font-semibold text-zinc-900">Questions</h4>
        {questions.map((question) => (
          <QuestionRow key={question.id} question={question} onUpdated={onUpdated} />
        ))}
        <AddQuestionForm
          scriptId={script.id}
          sentences={sentences}
          nextOrder={questions.length}
          onSuccess={onUpdated}
        />
      </div>
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

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={sentence.id} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800">Sentence {sentence.sequence_order}</p>
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDelete(async () => {
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
            defaultValue={sentence.gurmukhi_text}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Romanised</label>
          <input name="romanised_text" required defaultValue={sentence.romanised_text} className={inputClass} />
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

      <div className="mt-4">
        <AudioPanel
          contentType="comprehension_sentence"
          contentId={sentence.id}
          defaultScript={sentence.gurmukhi_text}
          scriptHint="Gurmukhi text for this sentence — used for listening mode playback."
        />
      </div>
    </div>
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
    <details className="rounded-xl border border-dashed border-zinc-300 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">
        Add sentence
      </summary>
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

function QuestionRow({
  question,
  onUpdated,
}: {
  question: AdminComprehensionQuestion;
  onUpdated: () => void;
}) {
  const [deletePending, startDelete] = useTransition();

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
      <p className="font-medium text-zinc-900">{question.question_text}</p>
      <p className="mt-1 text-zinc-600">
        A: {question.option_a} · B: {question.option_b} · C: {question.option_c} · D:{" "}
        {question.option_d}
      </p>
      <p className="mt-1 text-xs text-zinc-500">Correct: {question.correct_option.toUpperCase()}</p>
      <button
        type="button"
        disabled={deletePending}
        onClick={() =>
          startDelete(async () => {
            await deleteComprehensionQuestion(question.id);
            onUpdated();
          })
        }
        className={`${dangerButtonClass} mt-2`}
      >
        Delete question
      </button>
    </div>
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
    <details className="rounded-xl border border-dashed border-zinc-300 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">
        Add question
      </summary>
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
