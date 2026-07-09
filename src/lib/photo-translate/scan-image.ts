const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = [
  "You read photos of real-world Punjabi text (Gurmukhi script on signs, menus, labels, etc.) and help an English-speaking learner.",
  "Return ONLY valid JSON with no markdown code fences and no preamble.",
  'Shape: { "text_detected": boolean, "full_translation": string | null, "summary": string | null }',
  "If no Punjabi or Gurmukhi text is clearly visible, set text_detected to false and both other fields to null.",
  "Do not fabricate a translation from unclear images, English-only text, or guesses.",
  "When text_detected is true, full_translation must be a complete accurate English translation of all visible Punjabi/Gurmukhi text.",
  "summary must be 1-2 plain-English sentences about what matters practically (prices, warnings, type of sign) — not a repeat of full_translation.",
].join(" ");

export type PhotoTranslateScanResult = {
  text_detected: boolean;
  full_translation: string | null;
  summary: string | null;
};

function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  return key;
}

export function parsePhotoTranslateModelJson(raw: string): PhotoTranslateScanResult {
  let trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    trimmed = fenced[1].trim();
  }

  const parsed = JSON.parse(trimmed) as Partial<PhotoTranslateScanResult>;

  const textDetected = Boolean(parsed.text_detected);
  if (!textDetected) {
    return {
      text_detected: false,
      full_translation: null,
      summary: null,
    };
  }

  const fullTranslation =
    typeof parsed.full_translation === "string" ? parsed.full_translation.trim() : null;
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : null;

  if (!fullTranslation) {
    return {
      text_detected: false,
      full_translation: null,
      summary: null,
    };
  }

  return {
    text_detected: true,
    full_translation: fullTranslation,
    summary: summary || null,
  };
}

function normalizeMediaType(mediaType: string): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  if (mediaType === "image/png") return "image/png";
  if (mediaType === "image/webp") return "image/webp";
  if (mediaType === "image/gif") return "image/gif";
  return "image/jpeg";
}

export async function scanPhotoForPunjabiText(
  imageBytes: ArrayBuffer,
  mediaType: string
): Promise<PhotoTranslateScanResult> {
  const base64 = Buffer.from(imageBytes).toString("base64");
  const normalizedMediaType = normalizeMediaType(mediaType);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": getAnthropicApiKey(),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: normalizedMediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Translate all clearly visible Punjabi/Gurmukhi text in this photo.",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Photo scan failed (HTTP ${response.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text =
    payload.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    throw new Error("Photo scan returned an empty response.");
  }

  try {
    return parsePhotoTranslateModelJson(text);
  } catch {
    throw new Error("Could not parse the translation response — try another photo.");
  }
}
