/**
 * Smoke-check group tutorial wiring (no browser auth required).
 * Usage: node --import tsx scripts/verify-group-tutorials.ts
 */
import assert from "node:assert/strict";
import { getTutorialContent } from "../src/lib/games/tutorials/content";
import { tutorialIdForGroupGameType } from "../src/lib/games/tutorials/group";
import { GROUP_GAME_TYPES } from "../src/lib/game-rooms/constants";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const expected: Record<string, string> = {
  buzz_in: "buzz_in",
  jeopardy: "jeopardy",
  point_race: "point_race",
  chado_pauri_group: "chado_pauri_group",
  sentence_builder_group: "sentence_builder_group",
};

for (const gameType of GROUP_GAME_TYPES) {
  const id = tutorialIdForGroupGameType(gameType);
  assert.equal(id, expected[gameType], `${gameType} should map to a tutorial`);
  const content = getTutorialContent(id!);
  assert.ok(content.steps.length >= 2, `${id} needs at least 2 steps`);
  assert.match(content.steps.join(" "), /buzz|Buzz|tile|Race|ladder|sentence/i);
}

const lobbySrc = readFileSync(
  resolve("src/components/group-games/game-room-lobby.tsx"),
  "utf8"
);
assert.match(lobbySrc, /GameTutorialHost/);
assert.match(lobbySrc, /tutorialIdForGroupGameType/);

const arenaChecks: Array<{ file: string; tutorialId: string; earlyReturnGuard?: string }> = [
  {
    file: "src/components/group-games/chado-pauri-group-arena.tsx",
    tutorialId: "chado_pauri_group",
  },
  {
    file: "src/components/group-games/sentence-builder-group-arena.tsx",
    tutorialId: "sentence_builder_group",
    earlyReturnGuard: "Loading sentence",
  },
  {
    file: "src/components/group-games/buzz-in-arena.tsx",
    tutorialId: "buzz_in",
    earlyReturnGuard: "Loading next question",
  },
  {
    file: "src/components/group-games/jeopardy-arena.tsx",
    tutorialId: "jeopardy",
  },
  {
    file: "src/components/group-games/point-race-arena.tsx",
    tutorialId: "point_race",
  },
];

for (const check of arenaChecks) {
  const src = readFileSync(resolve(check.file), "utf8");
  const hostNeedle = `tutorialId="${check.tutorialId}"`;
  assert.match(src, /GameTutorialHost/);
  assert.ok(src.includes(hostNeedle), `${check.file} must mount ${hostNeedle}`);
  if (check.earlyReturnGuard) {
    const hostIndex = src.indexOf(hostNeedle);
    const loadingIndex = src.indexOf(check.earlyReturnGuard);
    assert.ok(hostIndex > 0, `${check.file} must include tutorial host`);
    assert.ok(
      loadingIndex > 0 && hostIndex < loadingIndex,
      `${check.file} tutorial host should stay mounted above loading branches`
    );
  }
}

console.log("Group tutorial wiring OK for all group game types:");
for (const gameType of GROUP_GAME_TYPES) {
  console.log(`- ${gameType} → ${tutorialIdForGroupGameType(gameType)}`);
}
