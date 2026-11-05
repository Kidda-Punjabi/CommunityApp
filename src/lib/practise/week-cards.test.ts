import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWeekCard, weekItemsFromCards } from "./week-cards.ts";

const card = (front_text: string, back_text: string, romanised: string | null = null) => ({ id: "x", front_text, back_text, romanised });

test("reads a plain word", () => {
  const item = parseWeekCard(card("door", "ਦਰਵਾਜ਼ਾ", "darvaja"));
  assert.equal(item?.kind, "word");
  assert.equal(item?.r, "darvaja");
});

test("takes the first form of a gendered sentence", () => {
  const item = parseWeekCard(card("I work.", "ਮੈਂ ਕੰਮ ਕਰਦਾ / ਕਰਦੀ ਹਾਂ", "Mai kam karda / kardi haa"));
  assert.equal(item?.kind, "sentence");
  assert.equal(item?.g, "ਮੈਂ ਕੰਮ ਕਰਦਾ ਹਾਂ");
  assert.equal(item?.r, "Mai kam karda haa");
});

test("reads brackets, week 1 questions and numbers", () => {
  assert.equal(parseWeekCard(card("He will go", "ਉਹ ਜਾਵੇਗਾ (oh jaavega)"))?.r, "oh jaavega");
  assert.equal(parseWeekCard(card("ਤੁਸੀਂ ਕਿੱਥੇ ਹੋ? (Tusi kithe ho?) — Where are you?", "ਮੈਂ ਘਰ ਹਾਂ"))?.e, "Where are you?");
  assert.equal(parseWeekCard(card("25", "੨੫ — ਪੱਚੀ", "pachi"))?.g, "ਪੱਚੀ");
});

test("leaves out grammar notes and unclear alternatives", () => {
  for (const [front, back] of [
    ["Verb root", "the part of the verb left"],
    ["Mai soch___ ___", "Mai sochdaa haa"],
    ["To come → Come", "ਆਉਣਾ → ਆਓ"],
    ["That → to that", "ਉਸ ਨੂੰ / ਉਹ ਨੂੰ"],
    ["Aux Verb that matches ਮੈਂ", "ਹਾਂ (haa)"],
    ["What's your age?", "ਮੈਂ [X] ਹਾਂ"],
  ]) {
    assert.equal(parseWeekCard(card(front, back)), null, front);
  }
});

test("removes duplicates by English", () => {
  assert.equal(weekItemsFromCards([card("Bad", "ਮਾੜਾ"), card("bad", "ਮਾੜਾ")]).length, 1);
});
