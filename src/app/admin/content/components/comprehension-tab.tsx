"use client";

import { AudioPanel, AudioStatusBadge } from "@/app/admin/content/components/audio-panel";
import {
  createComprehensionParagraph,
  createComprehensionQuestion,
  createComprehensionScript,
  createComprehensionSentence,
  deleteComprehensionParagraph,
  deleteComprehensionQuestion,
  deleteComprehensionScript,
  deleteComprehensionSentence,
  loadComprehensionAdminData,
  updateComprehensionScript,
  updateComprehensionSentence,
  type AdminComprehensionData,
  type AdminComprehensionParagraph,
  type AdminComprehensionQuestion,
  type AdminComprehensionScript,
  type AdminComprehensionSentence,
  type ComprehensionActionResult,
} from "@/app/admin/content/comprehension-actions";
import { orderSentencesForScript } from "@/lib/comprehension/order-sentences";
import {
  COMPREHENSION_DIFFICULTY_MAX,
  COMPREHENSION_DIFFICULTY_MIN,
  COMPREHENSION_TIERS,
  COMPREHENSION_TIER_HINTS,
  COMPREHENSION_TIER_LABELS,
} from "@/lib/comprehension/tiers";
import type { AudioAssetStatus } from "@/lib/audio/types";
import { useActionState, useCallback, useEffect, useMemo, useState, useTransition } from "react";
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

function scriptSummaryLine(
  script: AdminComprehensionScript,
  paragraphCount: number,
  sentences: AdminComprehensionSentence[],
  audioStatusBySentenceId: Record<string, AudioAssetStatus>
): string {
  const tierLabel = script.tier ? COMPREHENSION_TIER_LABELS[script.tier] : "No tier";
  const progress = scriptAudioProgress(sentences, audioStatusBySentenceId);
  return `${tierLabel} · ${paragraphCount} paragraph${paragraphCount === 1 ? "" : "s"} · ${sentences.length} sentence${sentences.length === 1 ? "" : "s"} · ${progress}`;
}

export function ComprehensionTab() {
  const [data, setData] = useState<AdminComprehensionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  const [expandedSentenceId, setExpandedSentenceId] = useState<string | null>(null);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [showNewScript, setShowNewScript] = useState(false);

  const patchAudioStatus = useCallback((sentenceId: string, status: AudioAssetStatus) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        audioStatusBySentenceId: {
          ...prev.audioStatusBySentenceId,
          [sentenceId]: status,
        },
      };
    });
  }, []);

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
        {data.error.includes("comprehension-paragraphs-tier") ? null : data.error.includes("does not exist") ? (
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
          Tiered scripts with paragraphs and per-sentence audio — expand one sentence at a time to
          edit and review.
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
            const paragraphs = data?.paragraphsByScript[script.id] ?? [];
            const sentences = data?.sentencesByScript[script.id] ?? [];
            const questions = data?.questionsByScript[script.id] ?? [];

            return (
              <ScriptAccordion
                key={script.id}
                script={script}
                paragraphs={paragraphs}
                sentences={sentences}
                questions={questions}
                audioStatusBySentenceId={audioStatusBySentenceId}
                expanded={expandedScriptId === script.id}
                expandedSentenceId={expandedSentenceId}
                expandedQuestionId={expandedQuestionId}
                onToggle={() => {
                  setExpandedScriptId((current) => (current === script.id ? null : script.id));
                  setExpandedSentenceId(null);
                  setExpandedQuestionId(null);
                }}
                onToggleSentence={(id) =>
                  setExpandedSentenceId((current) => (current === id ? null : id))
                }
                onToggleQuestion={(id) =>
                  setExpandedQuestionId((current) => (current === id ? null : id))
                }
                onUpdated={() => void refresh()}
                onAudioStatusChange={patchAudioStatus}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TierSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <select name="tier" required defaultValue={defaultValue ?? ""} className={inputClass}>
      <option value="" disabled>
        Select tier
      </option>
      {COMPREHENSION_TIERS.map((tier) => (
        <option key={tier} value={tier}>
          {COMPREHENSION_TIER_LABELS[tier]} — {COMPREHENSION_TIER_HINTS[tier]}
        </option>
      ))}
    </select>
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
        <label className={labelClass}>Tier (length)</label>
        <TierSelect />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" rows={2} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
            Difficulty ({COMPREHENSION_DIFFICULTY_MIN}–{COMPREHENSION_DIFFICULTY_MAX})
          </label>
          <input
            name="difficulty"
            type="number"
            min={COMPREHENSION_DIFFICULTY_MIN}
            max={COMPREHENSION_DIFFICULTY_MAX}
            className={inputClass}
          />
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
  paragraphs,
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
  onAudioStatusChange,
}: {
  script: AdminComprehensionScript;
  paragraphs: AdminComprehensionParagraph[];
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
  onAudioStatusChange: (sentenceId: string, status: AudioAssetStatus) => void;
}) {
  const orderedSentences = useMemo(
    () => orderSentencesForScript(paragraphs, sentences),
    [paragraphs, sentences]
  );
  const orphanSentences = sentences.filter((sentence) => !sentence.paragraph_id);
  const sentencesByParagraph = useMemo(() => {
    const map = new Map<string, AdminComprehensionSentence[]>();
    for (const paragraph of paragraphs) {
      map.set(
        paragraph.id,
        sentences
          .filter((sentence) => sentence.paragraph_id === paragraph.id)
          .sort((a, b) => a.sequence_order - b.sequence_order)
      );
    }
    return map;
  }, [paragraphs, sentences]);

  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-zinc-900">{script.title}</p>
            {script.needs_rewrite ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                Needs rewrite
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {scriptSummaryLine(script, paragraphs.length, sentences, audioStatusBySentenceId)}
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 px-4 pb-5 pt-2">
          {script.needs_rewrite ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This script uses the old flat structure — rewrite it as connected paragraphs rather
              than relabeling single sentences. Add paragraphs, move sentences into them, then clear
              &quot;Needs rewrite&quot; when the passage reads as a coherent script.
            </p>
          ) : null}

          <ScriptEditorForm script={script} onUpdated={onUpdated} />

          <div className="mt-6 space-y-4">
            <div>
              <h4 className="font-semibold text-zinc-900">Passage</h4>
              <p className="mt-1 text-sm text-zinc-500">
                Paragraphs group sentences only — audio is still generated per sentence.
              </p>
            </div>

            {paragraphs.length === 0 ? (
              <p className="text-sm text-zinc-500">No paragraphs yet — add one to start writing.</p>
            ) : (
              paragraphs
                .sort((a, b) => a.sequence_order - b.sequence_order)
                .map((paragraph) => (
                  <ParagraphGroup
                    key={paragraph.id}
                    scriptId={script.id}
                    paragraph={paragraph}
                    sentences={sentencesByParagraph.get(paragraph.id) ?? []}
                    allParagraphs={paragraphs}
                    audioStatusBySentenceId={audioStatusBySentenceId}
                    expandedSentenceId={expandedSentenceId}
                    onToggleSentence={onToggleSentence}
                    onUpdated={onUpdated}
                    onAudioStatusChange={onAudioStatusChange}
                  />
                ))
            )}

            {orphanSentences.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-sm font-semibold text-amber-900">
                  Legacy sentences (no paragraph)
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Assign these to a paragraph or delete after rewriting the script.
                </p>
                <ul className="mt-3 divide-y divide-amber-100 rounded-lg border border-amber-200 bg-white">
                  {orphanSentences.map((sentence) => (
                    <SentenceAccordionRow
                      key={sentence.id}
                      sentence={sentence}
                      paragraphs={paragraphs}
                      audioStatus={audioStatusBySentenceId[sentence.id] ?? "none"}
                      expanded={expandedSentenceId === sentence.id}
                      onToggle={() => onToggleSentence(sentence.id)}
                      onUpdated={onUpdated}
                      onAudioStatusChange={onAudioStatusChange}
                    />
                  ))}
                </ul>
              </div>
            ) : null}

            <AddParagraphForm scriptId={script.id} nextOrder={paragraphs.length + 1} onSuccess={onUpdated} />
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
              sentences={orderedSentences}
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
              if (!confirm("Delete this script and all its paragraphs/sentences/questions?")) return;
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
        <label className={labelClass}>Tier (length)</label>
        <TierSelect defaultValue={script.tier} />
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
          <label className={labelClass}>
            Difficulty ({COMPREHENSION_DIFFICULTY_MIN}–{COMPREHENSION_DIFFICULTY_MAX})
          </label>
          <input
            name="difficulty"
            type="number"
            min={COMPREHENSION_DIFFICULTY_MIN}
            max={COMPREHENSION_DIFFICULTY_MAX}
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
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          name="needs_rewrite"
          type="checkbox"
          defaultChecked={script.needs_rewrite}
          className="rounded border-zinc-300"
        />
        Needs rewrite (legacy flat content)
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending ? "Saving…" : "Save script"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}

function ParagraphGroup({
  scriptId,
  paragraph,
  sentences,
  allParagraphs,
  audioStatusBySentenceId,
  expandedSentenceId,
  onToggleSentence,
  onUpdated,
  onAudioStatusChange,
}: {
  scriptId: string;
  paragraph: AdminComprehensionParagraph;
  sentences: AdminComprehensionSentence[];
  allParagraphs: AdminComprehensionParagraph[];
  audioStatusBySentenceId: Record<string, AudioAssetStatus>;
  expandedSentenceId: string | null;
  onToggleSentence: (id: string) => void;
  onUpdated: () => void;
  onAudioStatusChange: (sentenceId: string, status: AudioAssetStatus) => void;
}) {
  const [deletePending, startDelete] = useTransition();

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
        <p className="text-sm font-semibold text-zinc-700">Paragraph {paragraph.sequence_order}</p>
        <button
          type="button"
          disabled={deletePending}
          onClick={() =>
            startDelete(async () => {
              if (!confirm(`Remove paragraph ${paragraph.sequence_order}?`)) return;
              await deleteComprehensionParagraph(paragraph.id);
              onUpdated();
            })
          }
          className="text-xs font-medium text-rose-700 hover:underline"
        >
          Remove empty paragraph
        </button>
      </div>

      {sentences.length === 0 ? (
        <p className="text-sm text-zinc-500">No sentences in this paragraph yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
          {sentences.map((sentence) => (
            <SentenceAccordionRow
              key={sentence.id}
              sentence={sentence}
              paragraphs={allParagraphs}
              audioStatus={audioStatusBySentenceId[sentence.id] ?? "none"}
              expanded={expandedSentenceId === sentence.id}
              onToggle={() => onToggleSentence(sentence.id)}
              onUpdated={onUpdated}
              onAudioStatusChange={onAudioStatusChange}
            />
          ))}
        </ul>
      )}

      <AddSentenceForm
        scriptId={scriptId}
        paragraphId={paragraph.id}
        nextOrder={sentences.length + 1}
        onSuccess={onUpdated}
      />
    </section>
  );
}

function SentenceAccordionRow({
  sentence,
  paragraphs,
  audioStatus,
  expanded,
  onToggle,
  onUpdated,
  onAudioStatusChange,
}: {
  sentence: AdminComprehensionSentence;
  paragraphs: AdminComprehensionParagraph[];
  audioStatus: AudioAssetStatus;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
  onAudioStatusChange: (sentenceId: string, status: AudioAssetStatus) => void;
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
          <SentenceEditor
            sentence={sentence}
            paragraphs={paragraphs}
            onUpdated={onUpdated}
            onAudioStatusChange={onAudioStatusChange}
          />
        </div>
      ) : null}
    </li>
  );
}

function SentenceEditor({
  sentence,
  paragraphs,
  onUpdated,
  onAudioStatusChange,
}: {
  sentence: AdminComprehensionSentence;
  paragraphs: AdminComprehensionParagraph[];
  onUpdated: () => void;
  onAudioStatusChange: (sentenceId: string, status: AudioAssetStatus) => void;
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
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Paragraph</label>
            <select
              name="paragraph_id"
              required
              defaultValue={sentence.paragraph_id ?? ""}
              className={inputClass}
            >
              {paragraphs.map((paragraph) => (
                <option key={paragraph.id} value={paragraph.id}>
                  Paragraph {paragraph.sequence_order}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Order in paragraph</label>
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
        onStatusChange={(status) => onAudioStatusChange(sentence.id, status)}
      />
    </div>
  );
}

function AddParagraphForm({
  scriptId,
  nextOrder,
  onSuccess,
}: {
  scriptId: string;
  nextOrder: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createComprehensionParagraph, initial);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <details className="rounded-xl border border-dashed border-zinc-300 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">
        + Add paragraph
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="script_id" value={scriptId} />
        <input type="hidden" name="sequence_order" value={nextOrder} />
        <p className="text-sm text-zinc-500">Paragraph {nextOrder} will be added to this script.</p>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add paragraph
        </button>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

function AddSentenceForm({
  scriptId,
  paragraphId,
  nextOrder,
  onSuccess,
}: {
  scriptId: string;
  paragraphId: string;
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
        <input type="hidden" name="paragraph_id" value={paragraphId} />
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
              {sentences.map((sentence, index) => (
                <option key={sentence.id} value={sentence.id}>
                  {index + 1}. {sentence.gurmukhi_text.slice(0, 40)}
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
