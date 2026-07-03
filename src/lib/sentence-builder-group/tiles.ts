import { shuffleArray } from "@/lib/flashcards/utils";

/** grammar_sentences.word_tiles entry (213 rows populated in production). */
export type GrammarWordTile = {
  gurmukhi: string;
  romanised: string;
  correct_position: number;
  is_distractor: boolean;
};

/** Shuffled pool tile — same id scheme as conversation `buildHardTileBank`. */
export type GroupSentencePoolTile = {
  tile_identifier: string;
  gurmukhi: string;
  romanised: string;
  correct_position: number;
  is_distractor: boolean;
};

export type PlacedSentenceTile = {
  tile_identifier: string;
  gurmukhi: string;
  romanised: string;
  correct_position: number;
};

export function parseGrammarWordTiles(raw: unknown): GrammarWordTile[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const gurmukhi = String(record.gurmukhi ?? "").trim();
      if (!gurmukhi) return null;

      return {
        gurmukhi,
        romanised: String(record.romanised ?? "").trim(),
        correct_position: Number(record.correct_position ?? 0),
        is_distractor: Boolean(record.is_distractor),
      };
    })
    .filter((tile): tile is GrammarWordTile => tile !== null);
}

/** Correct tiles in build order — mirrors `correctHardTileSequence`. */
export function correctTileSequence(tiles: GrammarWordTile[]): GrammarWordTile[] {
  return tiles
    .filter((tile) => !tile.is_distractor)
    .sort((a, b) => a.correct_position - b.correct_position);
}

export function nextExpectedPosition(
  tiles: GrammarWordTile[],
  filledCount: number
): number | null {
  const sequence = correctTileSequence(tiles);
  if (filledCount >= sequence.length) return null;
  return sequence[filledCount]!.correct_position;
}

export function isSentenceComplete(tiles: GrammarWordTile[], filledCount: number): boolean {
  return filledCount >= correctTileSequence(tiles).length;
}

/** Mirrors conversation `buildHardTileBank` — shuffle full word_tiles set with stable ids. */
export function buildGroupSentenceTilePool(
  sentenceId: string,
  wordTiles: GrammarWordTile[]
): GroupSentencePoolTile[] {
  return shuffleArray(wordTiles).map((tile, index) => ({
    tile_identifier: `${sentenceId}-${tile.gurmukhi}-${index}`,
    gurmukhi: tile.gurmukhi,
    romanised: tile.romanised,
    correct_position: tile.correct_position,
    is_distractor: tile.is_distractor,
  }));
}

export function poolTileByIdentifier(
  pool: GroupSentencePoolTile[],
  identifier: string
): GroupSentencePoolTile | undefined {
  return pool.find((tile) => tile.tile_identifier === identifier);
}

export function availablePoolTiles(
  pool: GroupSentencePoolTile[],
  filledSlots: PlacedSentenceTile[]
): GroupSentencePoolTile[] {
  const placed = new Set(filledSlots.map((slot) => slot.tile_identifier));
  return pool.filter((tile) => !placed.has(tile.tile_identifier));
}

export function evaluatePlacement(
  wordTiles: GrammarWordTile[],
  filledSlots: PlacedSentenceTile[],
  picked: GroupSentencePoolTile
): boolean {
  const expected = nextExpectedPosition(wordTiles, filledSlots.length);
  if (expected === null) return false;
  return !picked.is_distractor && picked.correct_position === expected;
}

export function placedTileFromPool(tile: GroupSentencePoolTile): PlacedSentenceTile {
  return {
    tile_identifier: tile.tile_identifier,
    gurmukhi: tile.gurmukhi,
    romanised: tile.romanised,
    correct_position: tile.correct_position,
  };
}
