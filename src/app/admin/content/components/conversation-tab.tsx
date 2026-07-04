"use client";

import { AudioPanel, AudioStatusBadge } from "@/app/admin/content/components/audio-panel";
import {
  createConversationScenario,
  createConversationScenarioCharacter,
  createConversationTurn,
  deleteConversationScenario,
  deleteConversationScenarioCharacter,
  deleteConversationTurn,
  loadConversationAdminData,
  updateConversationScenario,
  updateConversationScenarioCharacter,
  updateConversationTurn,
  type AdminConversationData,
  type AdminConversationScenario,
  type AdminConversationScenarioCharacter,
  type AdminConversationTurn,
  type ConversationActionResult,
} from "@/app/admin/content/conversation-actions";
import {
  DEFAULT_VETTED_VOICE_ID,
  VETTED_PUNJABI_VOICES,
} from "@/lib/elevenlabs/constants";
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

const initial: ConversationActionResult = {};

function previewText(text: string, max = 48): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function scriptProgress(
  turns: AdminConversationTurn[],
  audioStatusByTurnId: Record<string, AudioAssetStatus>
): string {
  const audioTurns = turns.filter((turn) => turn.requires_audio);
  if (audioTurns.length === 0 && turns.length > 0) {
    return `${turns.length} turns · no audio required (player lines only)`;
  }

  let approved = 0;
  let pending = 0;
  let needs = 0;
  let none = 0;

  for (const turn of audioTurns) {
    const status = audioStatusByTurnId[turn.id] ?? "none";
    if (status === "approved") approved += 1;
    else if (status === "pending_review") pending += 1;
    else if (status === "needs_changes") needs += 1;
    else none += 1;
  }

  const parts = [`${turns.length} turn${turns.length === 1 ? "" : "s"}`];
  if (approved) parts.push(`${approved} approved`);
  if (pending) parts.push(`${pending} pending`);
  if (needs) parts.push(`${needs} needs changes`);
  if (none) parts.push(`${none} not generated`);
  return parts.join(" · ");
}

function turnStatus(
  turn: AdminConversationTurn,
  audioStatusByTurnId: Record<string, AudioAssetStatus>
): AudioAssetStatus | "not_required" {
  if (!turn.requires_audio) return "not_required";
  return audioStatusByTurnId[turn.id] ?? "none";
}

function TurnStatusBadge({ status }: { status: AudioAssetStatus | "not_required" }) {
  if (status === "not_required") {
    return (
      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
        No audio needed
      </span>
    );
  }
  return <AudioStatusBadge status={status} />;
}

export function ConversationTab() {
  const [data, setData] = useState<AdminConversationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedScriptId, setExpandedScriptId] = useState<string | null>(null);
  const [expandedTurnId, setExpandedTurnId] = useState<string | null>(null);
  const [showNewScript, setShowNewScript] = useState(false);

  async function refresh() {
    setLoading(true);
    const result = await loadConversationAdminData();
    setData(result);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading conversation content…</p>;
  }

  if (data?.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
        {data.error}
        {data.error.includes("conversation-practice-turns") ? null : data.error.includes("does not exist") ? (
          <>
            {" "}
            Run <code className="text-xs">supabase/conversation-practice-turns.sql</code> first.
          </>
        ) : null}
      </p>
    );
  }

  const audioStatusByTurnId = data?.audioStatusByTurnId ?? {};

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-4 py-3 text-sm text-violet-950">
        <p className="font-semibold">Audio scope (confirmed for current game design)</p>
        <p className="mt-1 text-violet-900/90">
          The learner game shows NPC lines to listen to and prompts the player to speak their own
          lines — so generate audio for <strong>listener/NPC characters</strong> only. Player-role
          turns default to &quot;no audio needed&quot; but can be overridden if you want full audio
          for every line.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          Dialogue scripts with per-turn audio — expand one item at a time to edit and review.
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
          <h3 className="font-semibold text-zinc-900">New conversation script</h3>
          <CreateScriptForm
            globalCharacters={data?.globalCharacters ?? []}
            onSuccess={() => {
              setShowNewScript(false);
              void refresh();
            }}
          />
        </div>
      ) : null}

      {(data?.scenarios ?? []).length === 0 ? (
        <p className="text-sm text-zinc-500">No scripts yet — add one above.</p>
      ) : (
        <ul className="space-y-2">
          {(data?.scenarios ?? []).map((scenario) => {
            const cast = data?.castByScenario[scenario.id] ?? [];
            const turns = data?.turnsByScenario[scenario.id] ?? [];

            return (
              <ScriptAccordion
                key={scenario.id}
                scenario={scenario}
                cast={cast}
                turns={turns}
                globalCharacters={data?.globalCharacters ?? []}
                audioStatusByTurnId={audioStatusByTurnId}
                expanded={expandedScriptId === scenario.id}
                expandedTurnId={expandedTurnId}
                onToggle={() => {
                  setExpandedScriptId((current) => (current === scenario.id ? null : scenario.id));
                  setExpandedTurnId(null);
                }}
                onToggleTurn={(turnId) =>
                  setExpandedTurnId((current) => (current === turnId ? null : turnId))
                }
                onUpdated={() => void refresh()}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CreateScriptForm({
  globalCharacters,
  onSuccess,
}: {
  globalCharacters: AdminConversationData["globalCharacters"];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createConversationScenario, initial);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <form action={action} className="mt-4 space-y-4">
      <div>
        <label className={labelClass}>Learner role (game picker)</label>
        <select name="character_id" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Select global character
          </option>
          {globalCharacters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name} — {character.role}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          Links to the character card shown in the learner game. Cast members below are for dialogue
          labeling and voices within this script.
        </p>
      </div>
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" rows={2} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Difficulty (1–5)</label>
          <input name="difficulty" type="number" min={1} max={5} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Duration (minutes)</label>
          <input name="duration_minutes" type="number" min={1} className={inputClass} />
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
  scenario,
  cast,
  turns,
  globalCharacters,
  audioStatusByTurnId,
  expanded,
  expandedTurnId,
  onToggle,
  onToggleTurn,
  onUpdated,
}: {
  scenario: AdminConversationScenario;
  cast: AdminConversationScenarioCharacter[];
  turns: AdminConversationTurn[];
  globalCharacters: AdminConversationData["globalCharacters"];
  audioStatusByTurnId: Record<string, AudioAssetStatus>;
  expanded: boolean;
  expandedTurnId: string | null;
  onToggle: () => void;
  onToggleTurn: (turnId: string) => void;
  onUpdated: () => void;
}) {
  const castById = Object.fromEntries(cast.map((member) => [member.id, member]));

  return (
    <li className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left hover:bg-zinc-50"
      >
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{scenario.title}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {cast.length} character{cast.length === 1 ? "" : "s"} · {scriptProgress(turns, audioStatusByTurnId)}
          </p>
        </div>
        <span className="shrink-0 text-sm text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 px-4 pb-5 pt-2">
          <ScriptEditorForm
            scenario={scenario}
            globalCharacters={globalCharacters}
            onUpdated={onUpdated}
          />

          <div className="mt-6 space-y-3">
            <h4 className="font-semibold text-zinc-900">Characters in this script</h4>
            <p className="text-sm text-zinc-500">
              Set a default voice per character — new turns inherit it automatically.
            </p>
            {cast.length === 0 ? (
              <p className="text-sm text-amber-700">Add at least two characters before adding turns.</p>
            ) : (
              <ul className="space-y-2">
                {cast.map((member) => (
                  <CastMemberRow key={member.id} member={member} onUpdated={onUpdated} />
                ))}
              </ul>
            )}
            <AddCastMemberForm scenarioId={scenario.id} nextOrder={cast.length} onSuccess={onUpdated} />
          </div>

          <div className="mt-8 space-y-2">
            <h4 className="font-semibold text-zinc-900">Turns</h4>
            {cast.length < 2 ? (
              <p className="text-sm text-zinc-500">Add characters first, then dialogue turns.</p>
            ) : turns.length === 0 ? (
              <p className="text-sm text-zinc-500">No turns yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {turns.map((turn) => (
                  <TurnAccordionRow
                    key={turn.id}
                    turn={turn}
                    speaker={castById[turn.scenario_character_id]}
                    status={turnStatus(turn, audioStatusByTurnId)}
                    expanded={expandedTurnId === turn.id}
                    onToggle={() => onToggleTurn(turn.id)}
                    cast={cast}
                    onUpdated={onUpdated}
                  />
                ))}
              </ul>
            )}
            {cast.length >= 2 ? (
              <AddTurnForm
                scenarioId={scenario.id}
                cast={cast}
                nextOrder={turns.length + 1}
                onSuccess={onUpdated}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function ScriptEditorForm({
  scenario,
  globalCharacters,
  onUpdated,
}: {
  scenario: AdminConversationScenario;
  globalCharacters: AdminConversationData["globalCharacters"];
  onUpdated: () => void;
}) {
  const [state, action, pending] = useActionState(updateConversationScenario, initial);
  const [deletePending, startDelete] = useTransition();

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  return (
    <form action={action} className="space-y-3 rounded-xl bg-zinc-50 p-4">
      <input type="hidden" name="id" value={scenario.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-700">Script settings</p>
        <button
          type="button"
          disabled={deletePending}
          onClick={() =>
            startDelete(async () => {
              if (!confirm("Delete this script and all its characters/turns?")) return;
              await deleteConversationScenario(scenario.id);
              onUpdated();
            })
          }
          className={dangerButtonClass}
        >
          Delete script
        </button>
      </div>
      <div>
        <label className={labelClass}>Learner role (game picker)</label>
        <select name="character_id" defaultValue={scenario.character_id} className={inputClass}>
          {globalCharacters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name} — {character.role}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Title</label>
        <input name="title" required defaultValue={scenario.title} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={scenario.description ?? ""}
          className={inputClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Difficulty (1–5)</label>
          <input
            name="difficulty"
            type="number"
            min={1}
            max={5}
            defaultValue={scenario.difficulty ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Duration (minutes)</label>
          <input
            name="duration_minutes"
            type="number"
            min={1}
            defaultValue={scenario.duration_minutes ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Display order</label>
          <input
            name="display_order"
            type="number"
            defaultValue={scenario.display_order}
            className={inputClass}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          name="active"
          type="checkbox"
          defaultChecked={scenario.active}
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

function CastMemberRow({
  member,
  onUpdated,
}: {
  member: AdminConversationScenarioCharacter;
  onUpdated: () => void;
}) {
  const [state, action, pending] = useActionState(updateConversationScenarioCharacter, initial);
  const [deletePending, startDelete] = useTransition();

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  const voiceLabel =
    VETTED_PUNJABI_VOICES.find((voice) => voice.id === member.default_voice_id)?.label ??
    member.default_voice_id ??
    DEFAULT_VETTED_VOICE_ID;

  return (
    <li className="rounded-xl border border-zinc-200 p-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={member.id} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800">
            {member.name}
            {member.is_player_role ? (
              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">
                Player role
              </span>
            ) : null}
          </p>
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDelete(async () => {
                if (!confirm(`Remove character “${member.name}”?`)) return;
                await deleteConversationScenarioCharacter(member.id);
                onUpdated();
              })
            }
            className={dangerButtonClass}
          >
            Remove
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input name="name" required defaultValue={member.name} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Role label</label>
            <input name="role_label" defaultValue={member.role_label ?? ""} className={inputClass} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Default voice</label>
            <select
              name="default_voice_id"
              defaultValue={member.default_voice_id ?? DEFAULT_VETTED_VOICE_ID}
              className={inputClass}
            >
              {VETTED_PUNJABI_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">Currently: {voiceLabel}</p>
          </div>
          <div>
            <label className={labelClass}>Order</label>
            <input
              name="display_order"
              type="number"
              defaultValue={member.display_order}
              className={inputClass}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            name="is_player_role"
            type="checkbox"
            defaultChecked={member.is_player_role}
            className="rounded border-zinc-300"
          />
          Learner plays this character (lines usually need no audio)
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          Save character
        </button>
        <FormMessage state={state} />
      </form>
    </li>
  );
}

function AddCastMemberForm({
  scenarioId,
  nextOrder,
  onSuccess,
}: {
  scenarioId: string;
  nextOrder: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createConversationScenarioCharacter, initial);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <details className="rounded-xl border border-dashed border-zinc-300 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">+ Add character</summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="scenario_id" value={scenarioId} />
        <input type="hidden" name="display_order" value={nextOrder} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input name="name" required className={inputClass} placeholder="e.g. Shopkeeper" />
          </div>
          <div>
            <label className={labelClass}>Role label</label>
            <input name="role_label" className={inputClass} placeholder="Market vendor" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Default voice</label>
          <select name="default_voice_id" defaultValue={DEFAULT_VETTED_VOICE_ID} className={inputClass}>
            {VETTED_PUNJABI_VOICES.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input name="is_player_role" type="checkbox" className="rounded border-zinc-300" />
          Learner plays this character
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add character
        </button>
        <FormMessage state={state} />
      </form>
    </details>
  );
}

function TurnAccordionRow({
  turn,
  speaker,
  status,
  expanded,
  onToggle,
  cast,
  onUpdated,
}: {
  turn: AdminConversationTurn;
  speaker: AdminConversationScenarioCharacter | undefined;
  status: AudioAssetStatus | "not_required";
  expanded: boolean;
  onToggle: () => void;
  cast: AdminConversationScenarioCharacter[];
  onUpdated: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-zinc-50"
      >
        <span className="w-8 shrink-0 text-sm font-semibold text-zinc-500">{turn.sequence_order}.</span>
        <span className="w-24 shrink-0 truncate text-xs font-medium text-violet-700">
          {speaker?.name ?? "Unknown"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-900" dir="auto">
          {previewText(turn.gurmukhi_text)}
        </span>
        <TurnStatusBadge status={status} />
        <span className="shrink-0 text-zinc-400">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-3 py-4">
          <TurnEditor turn={turn} cast={cast} speaker={speaker} onUpdated={onUpdated} />
        </div>
      ) : null}
    </li>
  );
}

function TurnEditor({
  turn,
  cast,
  speaker,
  onUpdated,
}: {
  turn: AdminConversationTurn;
  cast: AdminConversationScenarioCharacter[];
  speaker: AdminConversationScenarioCharacter | undefined;
  onUpdated: () => void;
}) {
  const [state, action, pending] = useActionState(updateConversationTurn, initial);
  const [deletePending, startDelete] = useTransition();
  const [gurmukhi, setGurmukhi] = useState(turn.gurmukhi_text);

  useEffect(() => {
    setGurmukhi(turn.gurmukhi_text);
  }, [turn.gurmukhi_text]);

  useEffect(() => {
    if (state.success) onUpdated();
  }, [state.success, onUpdated]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={turn.id} />
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-800">Turn {turn.sequence_order}</p>
          <button
            type="button"
            disabled={deletePending}
            onClick={() =>
              startDelete(async () => {
                if (!confirm("Delete this turn?")) return;
                await deleteConversationTurn(turn.id);
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
            <label className={labelClass}>Speaker</label>
            <select
              name="scenario_character_id"
              defaultValue={turn.scenario_character_id}
              className={inputClass}
            >
              {cast.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Order</label>
            <input
              name="sequence_order"
              type="number"
              min={1}
              defaultValue={turn.sequence_order}
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
          <input name="romanised_text" required defaultValue={turn.romanised_text} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>English (optional)</label>
          <input
            name="english_translation"
            defaultValue={turn.english_translation ?? ""}
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            name="requires_audio"
            type="checkbox"
            defaultChecked={turn.requires_audio}
            className="rounded border-zinc-300"
          />
          Generate/review audio for this turn
        </label>
        <button type="submit" disabled={pending} className={secondaryButtonClass}>
          Save turn
        </button>
        <FormMessage state={state} />
      </form>

      {turn.requires_audio ? (
        <AudioPanel
          contentType="conversation_turn"
          contentId={turn.id}
          defaultScript={gurmukhi}
          defaultVoiceId={speaker?.default_voice_id ?? DEFAULT_VETTED_VOICE_ID}
          scriptHint="Gurmukhi line for this speaker — voice defaults to the character's setting above."
          onUpdated={onUpdated}
        />
      ) : (
        <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600">
          Audio skipped — this is a player line shown as a text prompt in the game. Enable
          &quot;Generate/review audio&quot; above if you want a clip anyway.
        </p>
      )}
    </div>
  );
}

function AddTurnForm({
  scenarioId,
  cast,
  nextOrder,
  onSuccess,
}: {
  scenarioId: string;
  cast: AdminConversationScenarioCharacter[];
  nextOrder: number;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createConversationTurn, initial);
  const [selectedCharacterId, setSelectedCharacterId] = useState(cast[0]?.id ?? "");
  const selectedCharacter = cast.find((member) => member.id === selectedCharacterId);

  useEffect(() => {
    if (state.success) onSuccess();
  }, [state.success, onSuccess]);

  return (
    <details className="rounded-xl border border-dashed border-zinc-300 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-violet-700">+ Add turn</summary>
      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="scenario_id" value={scenarioId} />
        <input type="hidden" name="sequence_order" value={nextOrder} />
        <div>
          <label className={labelClass}>Speaker</label>
          <select
            name="scenario_character_id"
            required
            value={selectedCharacterId}
            onChange={(event) => setSelectedCharacterId(event.target.value)}
            className={inputClass}
          >
            {cast.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
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
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            name="requires_audio"
            type="checkbox"
            defaultChecked={!selectedCharacter?.is_player_role}
            key={selectedCharacterId}
            className="rounded border-zinc-300"
          />
          Generate audio for this turn
        </label>
        <button type="submit" disabled={pending} className={buttonClass}>
          Add turn
        </button>
        <FormMessage state={state} />
      </form>
    </details>
  );
}
