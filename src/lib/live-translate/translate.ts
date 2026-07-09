import type { LiveTranslateDirection } from "@/lib/live-translate/config";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  return key;
}

function systemPrompt(direction: LiveTranslateDirection): string {
  if (direction === "en-to-pa") {
    return [
      "You translate spoken English into conversational Punjabi for a live conversation.",
      "Use Gurmukhi script.",
      "Translate naturally, not word-for-word.",
      "Return only the Punjabi translation with no commentary, labels, or quotes.",
    ].join(" ");
  }

  return [
    "You translate spoken Punjabi into conversational English for a live conversation.",
    "Translate naturally, not word-for-word.",
    "Return only the English translation with no commentary, labels, or quotes.",
  ].join(" ");
}

export async function translateLiveUtterance(
  text: string,
  direction: LiveTranslateDirection
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Nothing to translate.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": getAnthropicApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      system: systemPrompt(direction),
      messages: [
        {
          role: "user",
          content: trimmed,
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Translation failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const translated =
    payload.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim() ?? "";

  if (!translated) {
    throw new Error("Translation came back empty.");
  }

  return translated;
}
