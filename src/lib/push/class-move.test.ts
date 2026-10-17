import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classStartMoved } from "./class-move";

describe("classStartMoved", () => {
  it("treats the same instant in +00:00 and Z as unchanged", () => {
    assert.equal(
      classStartMoved("2026-10-19T18:00:00+00:00", "2026-10-19T18:00:00Z"),
      false
    );
  });

  it("treats the same instant in +01:00 and UTC as unchanged", () => {
    assert.equal(
      classStartMoved("2026-10-19T19:00:00+01:00", "2026-10-19T18:00:00Z"),
      false
    );
  });

  it("ignores a difference under one minute", () => {
    assert.equal(
      classStartMoved("2026-10-19T18:00:00Z", "2026-10-19T18:00:45Z"),
      false
    );
  });

  it("fires when the start moves by at least one minute", () => {
    assert.equal(
      classStartMoved("2026-10-19T18:00:00Z", "2026-10-19T18:01:00Z"),
      true
    );
  });
});
