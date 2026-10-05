import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import { test } from "node:test";

const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: NodeModule, id: string) {
  if (id === "server-only") return {};
  return originalRequire.apply(this, arguments as unknown as [string]);
};

const require = createRequire(import.meta.url);
const { omitTutorFromPullPatchIfManual } = require("./tutor-id-source.ts") as typeof import("./tutor-id-source.ts");

test("a manual tutor lock survives the next Notion pull", () => {
  const patch = omitTutorFromPullPatchIfManual(
    {
      name: "Practice Cohort",
      tutor_id: "notion-tutor",
      tutor_id_source: "notion",
    },
    "manual"
  );
  assert.equal(patch.name, "Practice Cohort");
  assert.equal("tutor_id" in patch, false);
  assert.equal("tutor_id_source" in patch, false);
});

test("a Notion-owned tutor is still updated from the pull", () => {
  const patch = omitTutorFromPullPatchIfManual(
    { tutor_id: "notion-tutor", tutor_id_source: "notion" },
    "notion"
  );
  assert.equal(patch.tutor_id, "notion-tutor");
  assert.equal(patch.tutor_id_source, "notion");
});
