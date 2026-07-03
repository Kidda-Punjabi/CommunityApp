"use client";

import { ComprehensionScriptViewer } from "@/components/comprehension/comprehension-script-viewer";
import type { ComprehensionMode } from "@/lib/comprehension/config";
import type { ComprehensionSentence, ComprehensionViewerPreferences } from "@/lib/comprehension/types";

type ComprehensionScriptOverlayProps = {
  open: boolean;
  title: string;
  sentences: ComprehensionSentence[];
  mode: ComprehensionMode;
  preferences: ComprehensionViewerPreferences;
  onPreferencesChange: (next: ComprehensionViewerPreferences) => void;
  onClose: () => void;
};

/**
 * Modal overlay — Q&A progress stays in the parent; closing only toggles visibility.
 */
export function ComprehensionScriptOverlay({
  open,
  title,
  sentences,
  mode,
  preferences,
  onPreferencesChange,
  onClose,
}: ComprehensionScriptOverlayProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">Script</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
        >
          Back to questions
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <ComprehensionScriptViewer
          title={title}
          sentences={sentences}
          mode={mode}
          preferences={preferences}
          onPreferencesChange={onPreferencesChange}
          emphasizeAudio={mode !== "reading"}
        />
      </div>
    </div>
  );
}
