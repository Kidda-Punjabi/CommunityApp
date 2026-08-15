import type { LevelTestQuestion } from "@/lib/progression/level-tests";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function firstString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = optionalString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function parseMcqContent(
  row: Record<string, unknown>,
  content: Record<string, unknown>
): LevelTestQuestion | null {
  const questionEnglish = optionalString(content.question_english);
  if (!questionEnglish) return null;

  const rawOptions = content.options;
  if (!Array.isArray(rawOptions) || rawOptions.length < 2) return null;

  const options = rawOptions.map((entry, index) => {
    const option = asRecord(entry) ?? {};
    return {
      id: String(index),
      textGurmukhi: firstString(option, "text_gurmukhi", "gurmukhi"),
      textRomanised: firstString(option, "text_romanised", "romanised"),
      textEnglish: firstString(option, "text_english", "english"),
    };
  });

  const correctIndex = Number(content.correct_index);
  if (
    !Number.isInteger(correctIndex) ||
    correctIndex < 0 ||
    correctIndex >= options.length
  ) {
    return null;
  }

  return {
    kind: "mcq",
    id: String(row.id ?? ""),
    from_level: Number(row.from_level ?? 0),
    question_order: Number(row.question_order ?? 0),
    questionGurmukhi: firstString(content, "question_gurmukhi", "gurmukhi"),
    questionRomanised: firstString(content, "question_romanised", "romanised"),
    questionEnglish,
    options,
    correctOptionId: String(correctIndex),
  };
}

function parseConjugationContent(
  row: Record<string, unknown>,
  content: Record<string, unknown>
): LevelTestQuestion | null {
  const punjabiSentenceWithBlank = firstString(
    content,
    "punjabi_sentence_with_blank",
    "punjabi_sentence"
  );
  const punjabiSentenceRomanised = firstString(
    content,
    "punjabi_sentence_with_blank_romanised",
    "punjabi_sentence_romanised"
  );
  const englishTranslation = optionalString(content.english_translation);
  const targetGurmukhi = firstString(
    content,
    "target_verb_gurmukhi",
    "gurmukhi"
  );
  const targetRomanised = firstString(
    content,
    "target_verb_romanised",
    "romanised"
  );
  const targetRootRomanised = firstString(
    content,
    "target_verb_root_romanised"
  );

  if (!punjabiSentenceWithBlank || !englishTranslation || !targetGurmukhi) {
    return null;
  }

  const distractors = Array.isArray(content.distractor_conjugations)
    ? content.distractor_conjugations
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => entry !== null)
        .map((entry) => ({
          gurmukhi: firstString(entry, "gurmukhi", "text_gurmukhi") ?? "",
          romanised: firstString(entry, "romanised", "text_romanised"),
        }))
        .filter((entry) => entry.gurmukhi.length > 0)
    : [];

  const correctOption = {
    id: "correct",
    gurmukhi: targetGurmukhi,
    romanised: targetRomanised,
  };

  const options = shuffle([
    correctOption,
    ...distractors.map((entry, index) => ({
      id: `distractor-${index}`,
      gurmukhi: entry.gurmukhi,
      romanised: entry.romanised,
    })),
  ]);

  return {
    kind: "conjugation_fill_blank",
    id: String(row.id ?? ""),
    from_level: Number(row.from_level ?? 0),
    question_order: Number(row.question_order ?? 0),
    punjabiSentenceWithBlank,
    punjabiSentenceRomanised:
      punjabiSentenceRomanised ??
      (targetRootRomanised ? `${targetRootRomanised} ___` : undefined),
    englishTranslation,
    options,
    correctOptionId: "correct",
  };
}

function parseSentenceBuilderContent(
  row: Record<string, unknown>,
  content: Record<string, unknown>
): LevelTestQuestion | null {
  const englishPrompt = optionalString(content.english_prompt);
  if (!englishPrompt) return null;

  const rawTiles = content.word_tiles;
  if (!Array.isArray(rawTiles) || rawTiles.length === 0) return null;

  const orderedTiles = rawTiles
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .map((entry) => ({
      gurmukhi: firstString(entry, "gurmukhi", "text_gurmukhi") ?? "",
      romanised: firstString(entry, "romanised", "text_romanised") ?? "",
    }))
    .filter((entry) => entry.gurmukhi.length > 0);

  if (orderedTiles.length === 0) return null;

  const correctTiles = orderedTiles.map((tile) => tile.gurmukhi);
  const tiles = shuffle(orderedTiles).map((tile, index) => ({
    id: `${String(row.id ?? "tile")}-${index}`,
    gurmukhi: tile.gurmukhi,
    romanised: tile.romanised,
  }));

  return {
    kind: "sentence_builder",
    id: String(row.id ?? ""),
    from_level: Number(row.from_level ?? 0),
    question_order: Number(row.question_order ?? 0),
    englishPrompt,
    correctTiles,
    correctRomanised: orderedTiles
      .map((tile) => tile.romanised)
      .filter(Boolean)
      .join(" "),
    tiles,
  };
}

function parseLegacyMcq(row: Record<string, unknown>): LevelTestQuestion | null {
  const questionText = optionalString(row.question_text);
  const optionA = optionalString(row.option_a);
  const optionB = optionalString(row.option_b);
  const optionC = optionalString(row.option_c);
  const optionD = optionalString(row.option_d);
  const correctAnswer = optionalString(row.correct_answer)?.toLowerCase();

  if (!questionText || !optionA || !optionB || !optionC || !optionD) return null;
  if (!correctAnswer || !["a", "b", "c", "d"].includes(correctAnswer)) return null;

  const legacyOptions = [
    { id: "0", textEnglish: optionA },
    { id: "1", textEnglish: optionB },
    { id: "2", textEnglish: optionC },
    { id: "3", textEnglish: optionD },
  ];

  const correctIndex = { a: "0", b: "1", c: "2", d: "3" }[correctAnswer];

  return {
    kind: "mcq",
    id: String(row.id ?? ""),
    from_level: Number(row.from_level ?? 0),
    question_order: Number(row.question_order ?? 0),
    questionEnglish: questionText,
    options: legacyOptions,
    correctOptionId: correctIndex ?? "0",
  };
}

export function parseLevelTestQuestion(
  row: Record<string, unknown>
): LevelTestQuestion | null {
  const questionType = optionalString(row.question_type);
  const content = asRecord(row.content);

  if (content && questionType) {
    switch (questionType) {
      case "mcq":
        return parseMcqContent(row, content);
      case "conjugation_fill_blank":
        return parseConjugationContent(row, content);
      case "sentence_builder":
        return parseSentenceBuilderContent(row, content);
      default:
        break;
    }
  }

  return parseLegacyMcq(row);
}
