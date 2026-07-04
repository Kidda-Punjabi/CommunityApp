import { getElevenLabsApiKey } from "@/lib/elevenlabs/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PronunciationRuleType = "alias" | "phoneme";

export type PronunciationRule = {
  id: string;
  source_word: string;
  rule_type: PronunciationRuleType;
  replacement: string;
  case_sensitive: boolean;
  word_boundaries: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ElevenLabsTtsConfig = {
  pronunciation_dictionary_id: string | null;
  pronunciation_dictionary_version_id: string | null;
};

type DictionaryLocator = {
  pronunciation_dictionary_id: string;
  version_id: string | null;
};

const DICTIONARY_NAME = "Kidda Punjabi";

function isAccessDenied(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("pronunciation") &&
    (lower.includes("access") || lower.includes("permission") || lower.includes("403"))
  );
}

async function elevenLabsFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.elevenlabs.io${path}`, {
    ...init,
    headers: {
      "xi-api-key": getElevenLabsApiKey(),
      ...(init.headers ?? {}),
    },
  });
}

async function loadTtsConfig(supabase: SupabaseClient): Promise<ElevenLabsTtsConfig | null> {
  const { data, error } = await supabase
    .from("elevenlabs_tts_config")
    .select("pronunciation_dictionary_id, pronunciation_dictionary_version_id")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("elevenlabs_tts_config")) return null;
    throw error;
  }

  return data;
}

async function saveTtsConfig(
  supabase: SupabaseClient,
  config: Partial<ElevenLabsTtsConfig>
): Promise<void> {
  const { error } = await supabase
    .from("elevenlabs_tts_config")
    .upsert(
      {
        id: 1,
        ...config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) throw error;
}

export async function loadPronunciationRules(
  supabase: SupabaseClient
): Promise<PronunciationRule[]> {
  const { data, error } = await supabase
    .from("pronunciation_dictionary_rules")
    .select("*")
    .order("source_word");

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("pronunciation_dictionary_rules")) return [];
    throw error;
  }

  return (data ?? []) as PronunciationRule[];
}

function toElevenLabsRule(rule: PronunciationRule) {
  if (rule.rule_type === "phoneme") {
    return {
      type: "phoneme" as const,
      string_to_replace: rule.source_word,
      phoneme: rule.replacement,
      alphabet: "ipa" as const,
      case_sensitive: rule.case_sensitive,
      word_boundaries: rule.word_boundaries,
    };
  }

  return {
    type: "alias" as const,
    string_to_replace: rule.source_word,
    alias: rule.replacement,
    case_sensitive: rule.case_sensitive,
    word_boundaries: rule.word_boundaries,
  };
}

async function createDictionaryFromRules(
  rules: PronunciationRule[]
): Promise<{ id: string; version_id: string }> {
  const response = await elevenLabsFetch("/v1/pronunciation-dictionaries/add-from-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: DICTIONARY_NAME,
      rules: rules.map(toElevenLabsRule),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      isAccessDenied(detail)
        ? "ElevenLabs API key lacks Pronunciation Dictionaries access (needs Read + Write). Update permissions in ElevenLabs account settings."
        : `Failed to create pronunciation dictionary: ${detail.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as {
    id: string;
    version_id: string;
  };

  return { id: payload.id, version_id: payload.version_id };
}

async function addRulesToDictionary(
  dictionaryId: string,
  rules: PronunciationRule[]
): Promise<string> {
  const response = await elevenLabsFetch(
    `/v1/pronunciation-dictionaries/${encodeURIComponent(dictionaryId)}/add-rules`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: rules.map(toElevenLabsRule),
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      isAccessDenied(detail)
        ? "ElevenLabs API key lacks Pronunciation Dictionaries access (needs Read + Write)."
        : `Failed to update pronunciation dictionary: ${detail.slice(0, 300)}`
    );
  }

  const payload = (await response.json()) as { version_id: string };
  return payload.version_id;
}

/** Push all local rules to ElevenLabs and refresh stored dictionary version. */
export async function syncPronunciationDictionary(
  supabase: SupabaseClient
): Promise<{ ok: true; locator: DictionaryLocator | null } | { ok: false; error: string }> {
  try {
    const rules = await loadPronunciationRules(supabase);
    if (rules.length === 0) {
      return { ok: true, locator: null };
    }

    const config = await loadTtsConfig(supabase);

    if (!config?.pronunciation_dictionary_id) {
      const created = await createDictionaryFromRules(rules);
      await saveTtsConfig(supabase, {
        pronunciation_dictionary_id: created.id,
        pronunciation_dictionary_version_id: created.version_id,
      });
      return {
        ok: true,
        locator: {
          pronunciation_dictionary_id: created.id,
          version_id: created.version_id,
        },
      };
    }

    const versionId = await addRulesToDictionary(config.pronunciation_dictionary_id, rules);
    await saveTtsConfig(supabase, {
      pronunciation_dictionary_version_id: versionId,
    });

    return {
      ok: true,
      locator: {
        pronunciation_dictionary_id: config.pronunciation_dictionary_id,
        version_id: versionId,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Pronunciation sync failed.",
    };
  }
}

export async function getPronunciationDictionaryLocator(
  supabase: SupabaseClient
): Promise<DictionaryLocator | null> {
  const config = await loadTtsConfig(supabase);
  if (!config?.pronunciation_dictionary_id) return null;

  return {
    pronunciation_dictionary_id: config.pronunciation_dictionary_id,
    version_id: config.pronunciation_dictionary_version_id,
  };
}

export async function upsertPronunciationRule(
  supabase: SupabaseClient,
  input: {
    sourceWord: string;
    ruleType: PronunciationRuleType;
    replacement: string;
    notes?: string | null;
  }
): Promise<{ ok: true; rule: PronunciationRule } | { ok: false; error: string }> {
  const sourceWord = input.sourceWord.trim();
  const replacement = input.replacement.trim();

  if (!sourceWord || !replacement) {
    return { ok: false, error: "Word and correction are required." };
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("pronunciation_dictionary_rules")
    .upsert(
      {
        source_word: sourceWord,
        rule_type: input.ruleType,
        replacement,
        notes: input.notes?.trim() || null,
        updated_at: now,
      },
      { onConflict: "source_word" }
    )
    .select("*")
    .single();

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("pronunciation_dictionary_rules")) {
      return {
        ok: false,
        error:
          "Run supabase/elevenlabs-audio-improvements.sql in Supabase to enable pronunciation rules.",
      };
    }
    return { ok: false, error: error.message };
  }

  const sync = await syncPronunciationDictionary(supabase);
  if (!sync.ok) {
    return { ok: false, error: sync.error };
  }

  return { ok: true, rule: data as PronunciationRule };
}
