import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickDebateId, planRoomActivities, type DebatePick, type TopicOffer } from "./room-activities";

const debate: DebatePick = {
  id: "chai",
  prompt: "Chai or coffee?",
  optionA: "Chai",
  optionB: "Coffee",
  promptPa: null,
  romanised: null,
};

const fullTopic: TopicOffer = {
  lessonId: "lesson",
  deckName: "Week 4 - Days of the Week & Dates (Community)",
  deckId: "deck",
  topicTags: ["days_of_week"],
  quizId: "quiz",
  quizTitle: "Week 4 Community Quiz: Days of the Week",
  speakingPromptCount: 8,
};

describe("planRoomActivities", () => {
  it("starts with a debate and ends with the bonus round", () => {
    const plan = planRoomActivities({ roomId: "room-a", band: "beginner", topic: fullTopic, debate });
    assert.equal(plan[0].kind, "warmup_debate");
    assert.equal(plan[plan.length - 1].kind, "bonus");
    assert.ok(plan.length >= 4 && plan.length <= 5);
  });

  it("uses beginner kinds and stays the same when refreshed", () => {
    const first = planRoomActivities({ roomId: "room-a", band: "beginner", topic: fullTopic, debate });
    const second = planRoomActivities({ roomId: "room-a", band: "beginner", topic: fullTopic, debate });
    assert.deepEqual(first, second);
    const middle = first.slice(1, -1).map((item) => item.kind);
    for (const kind of middle) {
      assert.ok(["flashcards", "point_race", "quiz"].includes(kind));
    }
  });

  it("uses speaking kinds for an advanced room", () => {
    const plan = planRoomActivities({ roomId: "room-b", band: "advanced", topic: fullTopic, debate });
    const middle = plan.slice(1, -1).map((item) => item.kind);
    for (const kind of middle) {
      assert.ok(["speaking_prompts", "point_race", "speak_it"].includes(kind));
    }
  });

  it("falls back to a generic Point Race when the topic has no content", () => {
    const empty: TopicOffer = {
      lessonId: null,
      deckName: null,
      deckId: null,
      topicTags: [],
      quizId: null,
      quizTitle: null,
      speakingPromptCount: 0,
    };
    const plan = planRoomActivities({ roomId: "room-c", band: "beginner", topic: empty, debate });
    assert.deepEqual(
      plan.map((item) => item.kind),
      ["warmup_debate", "point_race", "bonus"]
    );
    assert.deepEqual(plan[1].payload.topicTags, []);
  });
});

describe("pickDebateId", () => {
  it("picks the same debate for the same room", () => {
    const ids = ["b", "a", "c"];
    assert.equal(pickDebateId("room-a", ids), pickDebateId("room-a", ids));
    assert.equal(pickDebateId("room-a", []), null);
  });
});
