import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatClock,
  isUsableDuration,
  repairMediaDuration,
} from "./media-duration";

describe("isUsableDuration", () => {
  it("rejects Infinity, NaN, and non-positive values", () => {
    assert.equal(isUsableDuration(Infinity), false);
    assert.equal(isUsableDuration(Number.NaN), false);
    assert.equal(isUsableDuration(0), false);
    assert.equal(isUsableDuration(-1), false);
    assert.equal(isUsableDuration(null), false);
  });

  it("accepts a finite positive duration", () => {
    assert.equal(isUsableDuration(63), true);
    assert.equal(isUsableDuration(63.059), true);
  });
});

describe("formatClock", () => {
  it("formats minutes and seconds with zero padding", () => {
    assert.equal(formatClock(0), "00:00");
    assert.equal(formatClock(9), "00:09");
    assert.equal(formatClock(63), "01:03");
  });

  it("treats Infinity as 00:00 so a broken WebM duration never renders as NaN", () => {
    assert.equal(formatClock(Infinity), "00:00");
  });
});

describe("repairMediaDuration", () => {
  it("returns the existing duration when it is already finite", async () => {
    const media = fakeMedia(12);
    assert.equal(await repairMediaDuration(media), 12);
    assert.equal(media.currentTime, 0);
  });

  it("seeks to a huge timestamp then back to 0 once duration becomes finite", async () => {
    const media = fakeMedia(Infinity);
    media.revealDurationOnSeek = 63.059;

    const repaired = await repairMediaDuration(media);

    assert.equal(repaired, 63.059);
    assert.equal(media.currentTime, 0);
    assert.equal(media.maxSeek, Number.MAX_SAFE_INTEGER);
  });
});

type FakeMedia = HTMLMediaElement & {
  revealDurationOnSeek?: number;
  maxSeek?: number;
};

function fakeMedia(initialDuration: number): FakeMedia {
  const listeners = new Map<string, Set<() => void>>();
  let currentTime = 0;
  let duration = initialDuration;

  const media = {
    revealDurationOnSeek: undefined as number | undefined,
    maxSeek: 0,
    get duration() {
      return duration;
    },
    get currentTime() {
      return currentTime;
    },
    set currentTime(value: number) {
      currentTime = value;
      this.maxSeek = Math.max(this.maxSeek, value);
      if (this.revealDurationOnSeek != null && value >= Number.MAX_SAFE_INTEGER) {
        duration = this.revealDurationOnSeek;
        queueMicrotask(() => {
          listeners.get("timeupdate")?.forEach((fn) => fn());
        });
      }
    },
    addEventListener(type: string, fn: () => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: () => void) {
      listeners.get(type)?.delete(fn);
    },
  };

  return media as FakeMedia;
}
