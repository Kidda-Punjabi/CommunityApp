/**
 * Gemini image generation for bedtime story scenes.
 * Uses GEMINI_API_KEY. Prefer the cheaper Flash Image model.
 */

export const STORY_SCENE_IMAGE_MODEL = "gemini-2.5-flash-image";

/** Fallback if 2.5 Flash Image is unavailable on the project. */
export const STORY_SCENE_IMAGE_MODEL_FALLBACK = "gemini-3.1-flash-image";

export const STORY_SCENE_STYLE_PROMPT = `Warm children's book illustration, soft rounded shapes, gentle watercolor-like textures,
Punjab village atmosphere (earthy ochre, warm terracotta, soft green fields, peepal trees, golden evening light),
friendly expressive animal characters, consistent character design across scenes,
no text, no letters, no watermarks, no UI chrome, no photorealism.`;

export type GeneratedStoryImage = {
  bytes: Buffer;
  mimeType: string;
  model: string;
};

export type StoryImageReference = {
  mimeType: string;
  base64: string;
};

function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");
  return key;
}

function extractInlineImage(payload: unknown): { mimeType: string; data: string } | null {
  const candidates = (payload as { candidates?: Array<{ content?: { parts?: unknown[] } }> })
    ?.candidates;
  const parts = candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline =
      (part as { inlineData?: { mimeType?: string; data?: string } }).inlineData ??
      (part as { inline_data?: { mime_type?: string; data?: string } }).inline_data;
    if (!inline) continue;
    const mimeType =
      ("mimeType" in inline ? inline.mimeType : undefined) ??
      ("mime_type" in inline ? inline.mime_type : undefined) ??
      "image/png";
    const data = inline.data;
    if (data) return { mimeType, data };
  }
  return null;
}

async function generateWithModel(
  model: string,
  sceneEnglish: string,
  storyTitle: string,
  characterBible: string,
  references: StoryImageReference[]
): Promise<GeneratedStoryImage> {
  const key = getGeminiApiKey();
  const parts: Array<Record<string, unknown>> = [];

  for (const ref of references.slice(0, 3)) {
    parts.push({
      inline_data: {
        mime_type: ref.mimeType,
        data: ref.base64,
      },
    });
  }

  parts.push({
    text: [
      `Children's bedtime story scene for "${storyTitle}".`,
      "",
      "STYLE (must follow):",
      STORY_SCENE_STYLE_PROMPT,
      "",
      "CHARACTERS (keep identical across scenes):",
      characterBible,
      "",
      references.length
        ? "Use the attached reference image(s) to keep the same lion and mouse designs, colours, and proportions."
        : "Establish clear, memorable designs for the lion and mouse that can repeat in later scenes.",
      "",
      "SCENE TO ILLUSTRATE:",
      sceneEnglish.trim(),
      "",
      "Single full-bleed illustration, landscape-friendly composition, soft warm lighting.",
    ].join("\n"),
  });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    }
  );

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      (payload as { error?: { message?: string } })?.error?.message ??
      `Gemini image request failed (${response.status}).`;
    throw new Error(message);
  }

  const image = extractInlineImage(payload);
  if (!image) {
    throw new Error(`Gemini returned no image for model ${model}.`);
  }

  return {
    bytes: Buffer.from(image.data, "base64"),
    mimeType: image.mimeType || "image/png",
    model,
  };
}

export async function generateStorySceneImage(options: {
  sceneEnglish: string;
  storyTitle: string;
  characterBible: string;
  references?: StoryImageReference[];
}): Promise<GeneratedStoryImage> {
  const refs = options.references ?? [];
  const models = [STORY_SCENE_IMAGE_MODEL, STORY_SCENE_IMAGE_MODEL_FALLBACK];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await generateWithModel(
        model,
        options.sceneEnglish,
        options.storyTitle,
        options.characterBible,
        refs
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Try next model on not-found / unavailable.
      if (!/not found|no longer available|not available/i.test(lastError.message)) {
        // Quota / country / hard failures — still try fallback once for 2.5→3.1.
        if (model === STORY_SCENE_IMAGE_MODEL) continue;
        throw lastError;
      }
    }
  }

  throw lastError ?? new Error("Gemini image generation failed.");
}

/** Rough paid-tier estimate for Gemini 2.5 Flash Image (~$0.039/image). */
export const GEMINI_FLASH_IMAGE_USD_PER_IMAGE = 0.039;
