import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { notionPageHref } from "./enrollment-gaps-types";

describe("notionPageHref", () => {
  it("strips dashes from the Notion page id", () => {
    assert.equal(
      notionPageHref("381b5ac4-29c6-80fe-917f-e908eb9955f9"),
      "https://notion.so/381b5ac429c680fe917fe908eb9955f9"
    );
  });
});
