import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchSpeakingTranscript, passedSpeakingAttempt } from "./speaking-practice";
import { VOICE_PRACTICE_PASS_THRESHOLD } from "./voice-practice";

const HAFTA = {
  romanised: "Hafta",
  punjabi: "ਹਫ਼ਤਾ",
};

describe("matchSpeakingTranscript", () => {
  it("keeps the utterance gate at 80", () => {
    assert.equal(VOICE_PRACTICE_PASS_THRESHOLD, 80);
  });

  it("accepts a clear latin hafta for ਹਫ਼ਤਾ, including precomposed nukta", () => {
    assert.equal(passedSpeakingAttempt(matchSpeakingTranscript("hafta", HAFTA)), true);
    assert.equal(
      passedSpeakingAttempt(matchSpeakingTranscript("ਹਫ਼ਤਾ", HAFTA)),
      true
    );
    assert.equal(
      passedSpeakingAttempt(matchSpeakingTranscript("ਹ\u0A5Eਤਾ", HAFTA)),
      true
    );
    assert.equal(
      passedSpeakingAttempt(matchSpeakingTranscript("ਹਫਤਾ", HAFTA)),
      true
    );
  });

  it("folds nukta on other consonants and still accepts a word with none", () => {
    assert.equal(
      passedSpeakingAttempt(
        matchSpeakingTranscript("ਸ਼ਬਦ", { romanised: "shabad", punjabi: "ਸਬਦ" })
      ),
      true
    );
    assert.equal(
      passedSpeakingAttempt(
        matchSpeakingTranscript("\u0A36ਬਦ", { romanised: "shabad", punjabi: "ਸ਼ਬਦ" })
      ),
      true
    );
    assert.equal(
      passedSpeakingAttempt(
        matchSpeakingTranscript("ਪਾਣੀ", { romanised: "pani", punjabi: "ਪਾਣੀ" })
      ),
      true
    );
    assert.equal(
      passedSpeakingAttempt(
        matchSpeakingTranscript("ਖੂਨ", { romanised: "khoon", punjabi: "ਖ਼ੂਨ" })
      ),
      true
    );
    assert.equal(
      passedSpeakingAttempt(
        matchSpeakingTranscript("ਲਾਲ", { romanised: "laal", punjabi: "ਲ਼ਾਲ" })
      ),
      true
    );
  });

  it("ignores zero-width characters and still rejects an unrelated word", () => {
    assert.equal(
      passedSpeakingAttempt(matchSpeakingTranscript("ha\u200dfta", HAFTA)),
      true
    );
    assert.equal(
      passedSpeakingAttempt(matchSpeakingTranscript("week", HAFTA)),
      false
    );
    assert.equal(
      passedSpeakingAttempt(matchSpeakingTranscript("banana", HAFTA)),
      false
    );
  });
});
