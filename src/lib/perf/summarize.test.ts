import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeCall, percentile, sequentialChain } from "./summarize";
import type { PerfSpan } from "./types";

function span(start: number, ms: number): PerfSpan {
  return {
    kind: "supabase",
    name: "profiles",
    op: "select",
    ms,
    rows: 1,
    bytes: null,
    start,
    end: start + ms,
    parallel: false,
  };
}

describe("perf summarize", () => {
  it("names tables, rpcs, and external hosts without query values", () => {
    assert.deepEqual(
      describeCall(new URL("https://abc.supabase.co/rest/v1/profiles?id=eq.secret"), "GET"),
      { kind: "supabase", name: "profiles", op: "select" }
    );
    assert.deepEqual(
      describeCall(new URL("https://abc.supabase.co/rest/v1/rpc/get_home_summary"), "POST"),
      { kind: "supabase", name: "get_home_summary", op: "rpc" }
    );
    assert.equal(describeCall(new URL("https://api.notion.com/v1/pages/abc"), "GET")?.name, "notion");
    assert.equal(describeCall(new URL("https://abc.supabase.co/storage/v1/object/sign/media"), "POST")?.name, "storage");
  });

  it("counts a sequential chain and ignores overlapping calls", () => {
    const chain = sequentialChain([span(0, 100), span(100, 80), span(20, 50)]);
    assert.equal(chain.depth, 2);
    assert.equal(chain.ms, 180);
  });

  it("reads the nearest rank percentile", () => {
    assert.equal(percentile([10, 20, 30, 40], 50), 20);
    assert.equal(percentile([10, 20, 30, 40], 95), 40);
  });
});
