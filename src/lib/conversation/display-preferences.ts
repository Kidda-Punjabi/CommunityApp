export type ConversationDisplayPreset = "voice_note" | "reading" | "gurmukhi_only" | "custom";

export type ConversationDisplayPreferences = {
  showGurmukhi: boolean;
  showRomanised: boolean;
  showEnglish: boolean;
  preset: ConversationDisplayPreset;
};

export const CONVERSATION_DISPLAY_PRESETS: Record<
  Exclude<ConversationDisplayPreset, "custom">,
  Omit<ConversationDisplayPreferences, "preset">
> = {
  voice_note: {
    showGurmukhi: false,
    showRomanised: false,
    showEnglish: false,
  },
  reading: {
    showGurmukhi: true,
    showRomanised: true,
    showEnglish: true,
  },
  gurmukhi_only: {
    showGurmukhi: true,
    showRomanised: false,
    showEnglish: false,
  },
};

export const DEFAULT_CONVERSATION_DISPLAY_PREFERENCES: ConversationDisplayPreferences = {
  ...CONVERSATION_DISPLAY_PRESETS.reading,
  preset: "reading",
};

const STORAGE_PREFIX = "kidda:conversation-display:";

function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}${userId ?? "anonymous"}`;
}

function inferPreset(prefs: Omit<ConversationDisplayPreferences, "preset">): ConversationDisplayPreset {
  for (const [key, preset] of Object.entries(CONVERSATION_DISPLAY_PRESETS) as [
    Exclude<ConversationDisplayPreset, "custom">,
    Omit<ConversationDisplayPreferences, "preset">,
  ][]) {
    if (
      prefs.showGurmukhi === preset.showGurmukhi &&
      prefs.showRomanised === preset.showRomanised &&
      prefs.showEnglish === preset.showEnglish
    ) {
      return key;
    }
  }
  return "custom";
}

export function loadConversationDisplayPreferences(
  userId: string | null
): ConversationDisplayPreferences {
  if (typeof window === "undefined") return DEFAULT_CONVERSATION_DISPLAY_PREFERENCES;

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_CONVERSATION_DISPLAY_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<ConversationDisplayPreferences>;
    const showGurmukhi = Boolean(parsed.showGurmukhi);
    const showRomanised = Boolean(parsed.showRomanised);
    const showEnglish = Boolean(parsed.showEnglish);

    return {
      showGurmukhi,
      showRomanised,
      showEnglish,
      preset: parsed.preset ?? inferPreset({ showGurmukhi, showRomanised, showEnglish }),
    };
  } catch {
    return DEFAULT_CONVERSATION_DISPLAY_PREFERENCES;
  }
}

export function saveConversationDisplayPreferences(
  userId: string | null,
  prefs: ConversationDisplayPreferences
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // Ignore quota / private-mode errors.
  }
}

export function applyConversationDisplayPreset(
  preset: Exclude<ConversationDisplayPreset, "custom">
): ConversationDisplayPreferences {
  return {
    ...CONVERSATION_DISPLAY_PRESETS[preset],
    preset,
  };
}

export function withCustomDisplayToggles(
  current: ConversationDisplayPreferences,
  patch: Partial<Pick<ConversationDisplayPreferences, "showGurmukhi" | "showRomanised" | "showEnglish">>
): ConversationDisplayPreferences {
  const next = {
    showGurmukhi: patch.showGurmukhi ?? current.showGurmukhi,
    showRomanised: patch.showRomanised ?? current.showRomanised,
    showEnglish: patch.showEnglish ?? current.showEnglish,
  };

  return {
    ...next,
    preset: inferPreset(next),
  };
}
