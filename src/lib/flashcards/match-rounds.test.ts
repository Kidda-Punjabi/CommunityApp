import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FlashcardDeckCard } from "./types";
import {
  MATCH_PAIRS_PER_SCREEN,
  buildMatchTileChunks,
  chunkPairs,
  matchGameSeconds,
} from "./match-rounds";

function card(id: string): FlashcardDeckCard {
  return {
    id,
    front_text: `en-${id}`,
    back_text: `pa-${id}`,
    romanised: `rom-${id}`,
    deck_id: "deck",
    deck_name: "Deck",
  };
}

describe("matchGameSeconds", () => {
  it("is 10 seconds per pair", () => {
    assert.equal(matchGameSeconds(0), 0);
    assert.equal(matchGameSeconds(1), 10);
    assert.equal(matchGameSeconds(6), 60);
    assert.equal(matchGameSeconds(8), 80);
    assert.equal(matchGameSeconds(20), 200);
  });
});

describe("chunkPairs", () => {
  it("keeps a short list as a single chunk", () => {
    assert.deepEqual(chunkPairs([1, 2, 3, 4]), [[1, 2, 3, 4]]);
    assert.deepEqual(chunkPairs([1, 2]), [[1, 2]]);
    assert.deepEqual(chunkPairs([]), []);
  });

  it("splits longer lists into groups of four, with a short last chunk", () => {
    assert.deepEqual(chunkPairs([1, 2, 3, 4, 5, 6, 7, 8]), [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    assert.deepEqual(chunkPairs([1, 2, 3, 4, 5, 6]), [
      [1, 2, 3, 4],
      [5, 6],
    ]);
    assert.equal(chunkPairs(Array.from({ length: 15 }, (_, i) => i)).length, 4);
    assert.deepEqual(chunkPairs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]).at(-1), [
      13, 14, 15,
    ]);
  });
});

describe("buildMatchTileChunks", () => {
  it("puts at most four pairs (eight tiles) on each screen and never splits a pair", () => {
    const cards = Array.from({ length: 8 }, (_, i) => card(`c${i}`));
    const chunks = buildMatchTileChunks(cards, 42);

    assert.equal(chunks.length, 2);
    for (const tiles of chunks) {
      const cardIds = [...new Set(tiles.map((tile) => tile.cardId))];
      assert.ok(cardIds.length <= MATCH_PAIRS_PER_SCREEN);
      assert.equal(tiles.length, cardIds.length * 2);
      for (const id of cardIds) {
        const pairTiles = tiles.filter((tile) => tile.cardId === id);
        assert.equal(pairTiles.length, 2);
      }
    }

    const allCardIds = chunks.flatMap((tiles) => [
      ...new Set(tiles.map((tile) => tile.cardId)),
    ]);
    assert.equal(allCardIds.length, 8);
    assert.equal(new Set(allCardIds).size, 8);
  });

  it("is deterministic for the same challenge seed", () => {
    const cards = Array.from({ length: 6 }, (_, i) => card(`c${i}`));
    assert.deepEqual(buildMatchTileChunks(cards, 7), buildMatchTileChunks(cards, 7));
  });
});
