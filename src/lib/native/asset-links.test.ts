import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assetLinks } from "./asset-links";

describe("assetLinks", () => {
  it("returns a valid empty list before the fingerprints are set", () => {
    assert.deepEqual(assetLinks(undefined), []);
    assert.deepEqual(assetLinks(""), []);
    assert.deepEqual(assetLinks("  ,  "), []);
  });

  it("emits one statement per upload and Play signing fingerprint", () => {
    const links = assetLinks("AA:BB, CC:DD");
    assert.equal(links.length, 2);
    assert.equal(links[0]?.target.package_name, "app.kidda");
    assert.deepEqual(links[0]?.target.sha256_cert_fingerprints, ["AA:BB"]);
    assert.deepEqual(links[1]?.target.sha256_cert_fingerprints, ["CC:DD"]);
  });
});
