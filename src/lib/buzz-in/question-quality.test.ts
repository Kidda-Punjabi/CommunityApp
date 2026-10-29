import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBuzzInQuestionSet,
  classifyKind,
  dedupeCards,
  pickDistractors,
  toBuzzInCard,
  type BuzzInCard,
} from "./question-quality";
import { parseBuzzInSelection, resolveBuzzInSelection } from "./topic-catalogue";

function card(
  id: string,
  front: string,
  back: string,
  romanised: string | null,
  tags: string[] = []
): BuzzInCard {
  const result = toBuzzInCard({ id, front_text: front, back_text: back, romanised, topic_tags: tags });
  if (!result) throw new Error(`card ${id} rejected`);
  return result;
}

function seeded(seed = 7) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

describe("toBuzzInCard", () => {
  it("drops grammar formula cards", () => {
    assert.equal(
      toBuzzInCard({
        id: "f",
        front_text: "Punjabi sentence formula",
        back_text: "Subject + Object + Verb + Aux Verb",
        romanised: null,
      }),
      null
    );
  });

  it("drops cards with no romanisation", () => {
    assert.equal(
      toBuzzInCard({ id: "x", front_text: "He studies", back_text: "ਉਹ ਪੜ੍ਹਦਾ ਹੈ", romanised: null }),
      null
    );
  });

  it("uses the bracketed romanisation when the column is empty", () => {
    const result = toBuzzInCard({
      id: "b",
      front_text: "They will be able to come",
      back_text: "ਉਹ ਆ ਸਕਣਗੇ (oh aa sakange)",
      romanised: null,
    });
    assert.equal(result?.answer, "ਉਹ ਆ ਸਕਣਗੇ");
    assert.equal(result?.romanised, "oh aa sakange");
    assert.equal(result?.kind, "sentence");
  });

  it("strips Gurmukhi digits from number answers", () => {
    const result = toBuzzInCard({ id: "n", front_text: "36", back_text: "੩੬ — ਛੱਤੀ", romanised: "chhatti" });
    assert.equal(result?.answer, "ਛੱਤੀ");
    assert.equal(result?.kind, "number");
  });

  it("drops conversion drills", () => {
    assert.equal(
      toBuzzInCard({
        id: "d",
        front_text: "To write → Write (polite)",
        back_text: "ਲਿਖਣਾ → ਲਿਖੋ (likhna → likho)",
        romanised: "likhna → likho",
      }),
      null
    );
  });
});

describe("classifyKind", () => {
  it("treats two-word verbs as words and three or more as sentences", () => {
    assert.equal(classifyKind("to help", "ਮਦਦ ਕਰਨਾ"), "word");
    assert.equal(classifyKind("He needs to study", "ਉਸ ਨੂੰ ਪੜ੍ਹਨਾ ਚਾਹੀਦਾ ਹੈ"), "sentence");
  });
});

describe("pickDistractors", () => {
  const verbs = [
    card("v1", "to write", "ਲਿਖਣਾ", "likhna", ["verb"]),
    card("v2", "to read", "ਪੜ੍ਹਨਾ", "parhna", ["verb"]),
    card("v3", "to speak", "ਬੋਲਣਾ", "bolna", ["verb"]),
    card("v4", "to listen", "ਸੁਣਨਾ", "sunna", ["verb"]),
  ];
  const nouns = [
    card("n1", "ring", "ਮੁੰਦਰੀ", "mundri", ["noun"]),
    card("n2", "January", "ਜਨਵਰੀ", "janvari", ["noun"]),
  ];
  const sentences = [
    card("s1", "He needs to study", "ਉਸ ਨੂੰ ਪੜ੍ਹਨਾ ਚਾਹੀਦਾ ਹੈ", "usnu parhna chahida hai"),
    card("s2", "I need to study", "ਮੈਨੂੰ ਪੜ੍ਹਨਾ ਚਾਹੀਦਾ ਹੈ", "mainu parhna chahida hai"),
    card("s3", "He needs to eat", "ਉਸ ਨੂੰ ਖਾਣਾ ਚਾਹੀਦਾ ਹੈ", "usnu khana chahida hai"),
    card("s4", "He studies", "ਉਹ ਪੜ੍ਹਦਾ ਹੈ", "oh parhda hai"),
    card("s5", "We had to work late", "ਸਾਨੂੰ ਦੇਰ ਨਾਲ ਕੰਮ ਕਰਨਾ ਪੈਂਦਾ ਸੀ", "saanu der naal kam karna painda si"),
  ];
  const pool = [...verbs, ...nouns, ...sentences];

  it("gives a verb three other verbs", () => {
    const picked = pickDistractors(verbs[0], pool, seeded());
    assert.equal(picked.length, 3);
    assert.ok(picked.every((item) => item.wordTypes.includes("verb")));
  });

  it("gives a sentence only sentences, closest first", () => {
    const picked = pickDistractors(sentences[0], pool, seeded());
    assert.equal(picked.length, 3);
    assert.ok(picked.every((item) => item.kind === "sentence"));
    assert.ok(picked.some((item) => item.id === "s2" || item.id === "s3"));
  });

  it("never offers the right answer twice or a same-meaning card", () => {
    const duplicate = card("v1b", "to write", "ਲਿਖਣਾ (likhna)", null, ["verb"]);
    const picked = pickDistractors(verbs[0], [...pool, duplicate], seeded());
    assert.ok(picked.every((item) => item.answer !== "ਲਿਖਣਾ"));
  });
});

describe("buildBuzzInQuestionSet", () => {
  it("never repeats a question", () => {
    const cards = [
      card("a", "to write", "ਲਿਖਣਾ", "likhna", ["verb", "week_6"]),
      card("a2", "to write", "ਲਿਖਣਾ", "likhna", ["verb", "week_6"]),
      card("b", "to read", "ਪੜ੍ਹਨਾ", "parhna", ["verb", "week_6"]),
      card("c", "to speak", "ਬੋਲਣਾ", "bolna", ["verb", "week_6"]),
      card("d", "to listen", "ਸੁਣਨਾ", "sunna", ["verb", "week_6"]),
    ];
    assert.equal(dedupeCards(cards).length, 4);
    const questions = buildBuzzInQuestionSet(cards, cards, 10, seeded());
    assert.equal(questions.length, 4);
    assert.equal(new Set(questions.map((q) => q.prompt)).size, 4);
    for (const q of questions) {
      assert.equal(q.options.length, 4);
      assert.ok(q.options.includes(q.correct_answer));
      assert.ok(q.options_romanised?.every((value) => Boolean(value)));
    }
  });
});

describe("resolveBuzzInSelection", () => {
  it("maps a Beginners week to its tag", () => {
    assert.deepEqual(resolveBuzzInSelection({ mode: "week", courseId: "beginners", week: 6 }), {
      tags: ["week_6"],
      label: "Week 6",
    });
  });

  it("refuses coming-soon courses and the presentation week", () => {
    assert.ok("error" in resolveBuzzInSelection({ mode: "week", courseId: "intermediate", week: 1 }));
    assert.ok("error" in resolveBuzzInSelection({ mode: "week", courseId: "beginners", week: 12 }));
  });

  it("merges theme tags and labels the pick", () => {
    const resolved = resolveBuzzInSelection({ mode: "themes", themeIds: ["food", "numbers"] });
    assert.ok(!("error" in resolved));
    if (!("error" in resolved)) {
      assert.deepEqual(resolved.tags, ["food", "number", "numbers", "ordinal"]);
      assert.equal(resolved.label, "Food and Numbers");
    }
  });

  it("parses only well-formed selections", () => {
    assert.equal(parseBuzzInSelection("not json"), null);
    assert.equal(parseBuzzInSelection(JSON.stringify({ mode: "week", courseId: "nope", week: 1 })), null);
    assert.deepEqual(parseBuzzInSelection(JSON.stringify({ mode: "mixed", courseId: "community" })), {
      mode: "mixed",
      courseId: "community",
    });
  });
});
