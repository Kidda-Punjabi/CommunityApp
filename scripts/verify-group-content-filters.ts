/**
 * Unit checks for group-game content filters (no DB required).
 * Usage: node --import tsx scripts/verify-group-content-filters.ts
 */
import assert from "node:assert/strict";
import {
  buildRoomContentSettings,
  contentFiltersFromSettings,
  filterByContentFilters,
  itemMatchesDifficulty,
  itemMatchesTopicTags,
  parseTopicTagsFromForm,
  topicFiltersFromSettings,
} from "../src/lib/group-games/content-filters";

assert.deepEqual(parseTopicTagsFromForm(JSON.stringify(["Food", " food ", "TRAVEL"])), [
  "food",
  "travel",
]);

assert.equal(itemMatchesTopicTags(["Food", "Basics"], ["food"]), true);
assert.equal(itemMatchesTopicTags(["travel"], ["food"]), false);
assert.equal(itemMatchesTopicTags(["travel"], []), true);

assert.equal(itemMatchesTopicTags(["week_2", "aux_verb"], ["aux_verb"]), true);
assert.equal(itemMatchesTopicTags(["week_6", "question_word"], ["week_6"]), true);
assert.equal(itemMatchesTopicTags(["week_6", "question_word"], ["aux_verb"]), false);

assert.equal(itemMatchesDifficulty(3, 2, 4), true);
assert.equal(itemMatchesDifficulty(1, 2, 4), false);
assert.equal(itemMatchesDifficulty(null, 2, 4), false);
assert.equal(itemMatchesDifficulty(5, null, null), true);

const cards = [
  { id: "a", topic_tags: ["food"], difficulty: 1 },
  { id: "b", topic_tags: ["food"], difficulty: 3 },
  { id: "c", topic_tags: ["travel"], difficulty: 2 },
  { id: "d", topic_tags: ["travel"], difficulty: 5 },
];

const topicOnly = filterByContentFilters(
  cards,
  { topicTags: ["food"], difficultyMin: null, difficultyMax: null },
  (c) => c.topic_tags,
  (c) => c.difficulty
);
assert.deepEqual(
  topicOnly.matched.map((c) => c.id).sort(),
  ["a", "b"]
);
assert.equal(topicOnly.usedFallback, false);

const laterTag = filterByContentFilters(
  [
    { id: "w", topic_tags: ["week_2", "aux_verb"], difficulty: 1 },
    { id: "x", topic_tags: ["week_6", "verb"], difficulty: 1 },
  ],
  { topicTags: ["aux_verb"], difficultyMin: null, difficultyMax: null },
  (c) => c.topic_tags,
  (c) => c.difficulty
);
assert.deepEqual(
  laterTag.matched.map((c) => c.id),
  ["w"]
);
assert.equal(laterTag.usedFallback, false);

const noMatch = filterByContentFilters(
  cards,
  { topicTags: ["aux_verb"], difficultyMin: null, difficultyMax: null },
  (c) => c.topic_tags,
  (c) => c.difficulty
);
assert.deepEqual(noMatch.matched, []);
assert.equal(noMatch.usedFallback, false);

const settings = buildRoomContentSettings({
  questionCount: 12,
  gameType: "buzz_in",
  topicTags: ["food"],
});
assert.equal(settings.question_count, 12);
assert.deepEqual(settings.topic_tags, ["food"]);
assert.equal(settings.difficulty_min, undefined);
assert.equal(settings.difficulty_max, undefined);

const jeopardySettings = buildRoomContentSettings({
  questionCount: 10,
  gameType: "jeopardy",
  topicTags: ["alphabet"],
});
assert.deepEqual(jeopardySettings.topic_tags, ["alphabet"]);
assert.equal(jeopardySettings.difficulty_min, undefined);

const chadoSettings = buildRoomContentSettings({
  questionCount: 10,
  gameType: "chado_pauri_group",
  topicTags: ["food"],
});
assert.equal(chadoSettings.topic_tags, undefined);

// Legacy difficulty keys in settings are ignored by topicFiltersFromSettings.
assert.deepEqual(
  topicFiltersFromSettings({
    topic_tags: ["food"],
    difficulty_min: 4,
    difficulty_max: 5,
  }),
  { topicTags: ["food"], difficultyMin: null, difficultyMax: null }
);

assert.deepEqual(contentFiltersFromSettings(settings), {
  topicTags: ["food"],
  difficultyMin: null,
  difficultyMax: null,
});

console.log("Group content filter checks OK");
