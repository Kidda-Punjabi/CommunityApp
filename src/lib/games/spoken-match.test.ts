import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { passedSpokenAttempt, scoreSpokenAttempt } from "./spoken-match";

const passes = (heard: string, romanised: string, punjabi?: string) =>
  passedSpokenAttempt(scoreSpokenAttempt(heard, { romanised, punjabi }));

describe("spoken marking", () => {
  const sentence = { r: "main roti khaanda haan", p: "ਮੈਂ ਰੋਟੀ ਖਾਂਦਾ ਹਾਂ" };
  it("passes the exact answer in any script", () => {
    assert.equal(passes("ਮੈਂ ਰੋਟੀ ਖਾਂਦਾ ਹਾਂ", sentence.r, sentence.p), true);
    assert.equal(passes("main roti khanda han", sentence.r, sentence.p), true);
    assert.equal(passes("मैं रोटी खांदा हां", sentence.r, sentence.p), true);
  });
  it("passes a different word order", () => assert.equal(passes("ਰੋਟੀ ਮੈਂ ਖਾਂਦਾ ਹਾਂ", sentence.r, sentence.p), true));
  it("passes with most of the words", () => assert.equal(passes("ਮੈਂ ਰੋਟੀ ਖਾਂਦਾ", sentence.r, sentence.p), true));
  it("passes with extra words", () => assert.equal(passes("ਹਾਂ ਜੀ ਮੈਂ ਰੋਟੀ ਖਾਂਦਾ ਹਾਂ", sentence.r, sentence.p), true));
  it("passes different word breaks", () => assert.equal(passes("ਮੈਂਰੋਟੀ ਖਾਂਦਾਹਾਂ", sentence.r, sentence.p), true));
  it("passes tonal letters heard another way", () => {
    assert.equal(passes("ਕਰ", "ghar", "ਘਰ"), true);
    assert.equal(passes("ਤੀ", "dhee", "ਧੀ"), true);
    assert.equal(passes("ਪਰਾ", "bhra", "ਭਰਾ"), true);
  });
  it("passes one-word answers with a small slip", () => {
    assert.equal(passes("hafta", "hafta", "ਹਫ਼ਤਾ"), true);
    assert.equal(passes("ਹਫਤਾ", "hafta", "ਹਫ਼ਤਾ"), true);
    assert.equal(passes("paani", "pani", "ਪਾਣੀ"), true);
  });
  it("passes the other gender's form", () => {
    assert.equal(passes("ਮੈਂ ਕੰਮ ਕਰਦੀ ਹਾਂ", "main kamm karda haan", "ਮੈਂ ਕੰਮ ਕਰਦਾ ਹਾਂ"), true);
    assert.equal(passes("ਕਰਦੀ", "karda", "ਕਰਦਾ"), true);
    assert.equal(passes("ਗਈ", "gia", "ਗਿਆ"), true);
    assert.equal(passes("ਮੈਂ ਗਈ", "main gia", "ਮੈਂ ਗਿਆ"), true);
    assert.equal(passes("ਚੰਗੀ", "changa", "ਚੰਗਾ"), true);
    assert.equal(passes("ਜਾਵਾਂਗੀ", "javanga", "ਜਾਵਾਂਗਾ"), true);
  });
  it("fails a different word", () => {
    assert.equal(passes("week", "hafta", "ਹਫ਼ਤਾ"), false);
    assert.equal(passes("banana", "hafta", "ਹਫ਼ਤਾ"), false);
    assert.equal(passes("ਰਾਣੀ", "pani", "ਪਾਣੀ"), false);
  });
  it("fails with only a minority of the words", () => {
    assert.equal(passes("ਮੈਂ", sentence.r, sentence.p), false);
    assert.equal(passes("ਤੂੰ ਕਿੱਥੇ ਜਾ ਰਿਹਾ ਹੈਂ", sentence.r, sentence.p), false);
  });
  it("fails silence", () => assert.equal(passes("", sentence.r, sentence.p), false));
});
