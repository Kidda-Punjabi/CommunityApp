"use client";

import {
  applyConversationDisplayPreset,
  type ConversationDisplayPreferences,
  type ConversationDisplayPreset,
  withCustomDisplayToggles,
} from "@/lib/conversation/display-preferences";
import { useEffect, useRef, useState } from "react";

type ConversationDisplaySettingsProps = {
  preferences: ConversationDisplayPreferences;
  onChange: (next: ConversationDisplayPreferences) => void;
};

const PRESET_OPTIONS: {
  id: Exclude<ConversationDisplayPreset, "custom">;
  label: string;
  description: string;
}[] = [
  {
    id: "voice_note",
    label: "Voice note",
    description: "Audio only — all text hidden",
  },
  {
    id: "reading",
    label: "Reading",
    description: "Gurmukhi, romanized, and English",
  },
  {
    id: "gurmukhi_only",
    label: "Gurmukhi only",
    description: "Script without romanization or English",
  },
];

export function ConversationDisplaySettings({
  preferences,
  onChange,
}: ConversationDisplaySettingsProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function applyPreset(preset: Exclude<ConversationDisplayPreset, "custom">) {
    onChange(applyConversationDisplayPreset(preset));
  }

  function toggleField(field: "showGurmukhi" | "showRomanised" | "showEnglish") {
    onChange(
      withCustomDisplayToggles(preferences, {
        [field]: !preferences[field],
      })
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:border-violet-300 hover:text-violet-700"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Display settings"
      >
        <span aria-hidden="true">⚙</span>
        Display
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Conversation display settings"
          className="absolute right-0 z-20 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Presets</p>
          <div className="mt-2 space-y-1.5">
            {PRESET_OPTIONS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  preferences.preset === preset.id
                    ? "bg-violet-50 text-violet-900 ring-1 ring-violet-200"
                    : "hover:bg-zinc-50 text-zinc-800"
                }`}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="mt-0.5 block text-xs text-zinc-500">{preset.description}</span>
              </button>
            ))}
          </div>

          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Show text
          </p>
          <div className="mt-2 space-y-2">
            <label className="flex items-center justify-between gap-3 text-sm text-zinc-800">
              <span>Gurmukhi</span>
              <input
                type="checkbox"
                checked={preferences.showGurmukhi}
                onChange={() => toggleField("showGurmukhi")}
                className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-zinc-800">
              <span>Romanized</span>
              <input
                type="checkbox"
                checked={preferences.showRomanised}
                onChange={() => toggleField("showRomanised")}
                className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-zinc-800">
              <span>English</span>
              <input
                type="checkbox"
                checked={preferences.showEnglish}
                onChange={() => toggleField("showEnglish")}
                className="h-4 w-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500"
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
