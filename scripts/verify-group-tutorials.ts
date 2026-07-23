/**
 * Smoke-check group tutorial wiring (no browser auth required).
 * Usage: node --import tsx scripts/verify-group-tutorials.ts
 */
import assert from "node:assert/strict";
import { getTutorialContent } from "../src/lib/games/tutorials/content";
import { tutorialIdForGroupGameType } from "../src/lib/games/tutorials/group";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const chadoId = tutorialIdForGroupGameType("chado_pauri_group");
const sentenceId = tutorialIdForGroupGameType("sentence_builder_group");
const buzzId = tutorialIdForGroupGameType("buzz_in");

assert.equal(chadoId, "chado_pauri_group");
assert.equal(sentenceId, "sentence_builder_group");
assert.equal(buzzId, null);

const chado = getTutorialContent("chado_pauri_group");
const sentence = getTutorialContent("sentence_builder_group");
assert.ok(chado.steps.length >= 2);
assert.ok(sentence.steps.length >= 2);

const lobbySrc = readFileSync(
  resolve("src/components/group-games/game-room-lobby.tsx"),
  "utf8"
);
assert.match(lobbySrc, /GameTutorialHost/);
assert.match(lobbySrc, /tutorialIdForGroupGameType/);

const chadoArenaSrc = readFileSync(
  resolve("src/components/group-games/chado-pauri-group-arena.tsx"),
  "utf8"
);
assert.match(chadoArenaSrc, /tutorialId="chado_pauri_group"/);

const sentenceArenaSrc = readFileSync(
  resolve("src/components/group-games/sentence-builder-group-arena.tsx"),
  "utf8"
);
assert.match(sentenceArenaSrc, /tutorialId="sentence_builder_group"/);
// Host must not only live behind activeRound early-returns
assert.match(sentenceArenaSrc, /Loading sentence/);
const hostIndex = sentenceArenaSrc.indexOf('tutorialId="sentence_builder_group"');
const loadingIndex = sentenceArenaSrc.indexOf("Loading sentence");
assert.ok(hostIndex > 0, "sentence builder must include GameTutorialHost");
assert.ok(
  loadingIndex > 0 && hostIndex < loadingIndex,
  "sentence builder tutorial host should stay mounted above loading/content branches"
);

console.log("Group tutorial wiring OK:");
console.log(`- lobby maps chado_pauri_group → ${chadoId}`);
console.log(`- lobby maps sentence_builder_group → ${sentenceId}`);
console.log(`- content titles: ${chado.title} / ${sentence.title}`);
