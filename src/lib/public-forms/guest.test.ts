import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateGuestIdentity } from "./guest";

const valid = {
  fullName: "Simran Kaur",
  email: "parent@example.com",
  phone: "07700900000",
};

describe("validateGuestIdentity", () => {
  it("still requires name, email, and phone by default", () => {
    assert.equal(validateGuestIdentity({ fullName: "Simran" }).ok, false);
    assert.equal(validateGuestIdentity({ ...valid, email: "" }).ok, false);
    assert.equal(validateGuestIdentity({ ...valid, phone: "" }).ok, false);
    const ok = validateGuestIdentity(valid);
    assert.equal(ok.ok, true);
  });

  it("lets kids forms skip email and phone, but still checks them if filled", () => {
    const skipped = validateGuestIdentity(
      { fullName: "Aria", email: "  ", phone: "" },
      { requireContact: false }
    );
    assert.deepEqual(skipped, {
      ok: true,
      identity: { fullName: "Aria", email: "", phone: "" },
    });

    const emailOnly = validateGuestIdentity(
      { fullName: "Aria", email: "parent@example.com", phone: "" },
      { requireContact: false }
    );
    assert.equal(emailOnly.ok, true);
    if (emailOnly.ok) {
      assert.equal(emailOnly.identity.email, "parent@example.com");
      assert.equal(emailOnly.identity.phone, "");
    }

    const badEmail = validateGuestIdentity(
      { fullName: "Aria", email: "not-an-email", phone: "" },
      { requireContact: false }
    );
    assert.equal(badEmail.ok, false);

    const badPhone = validateGuestIdentity(
      { fullName: "Aria", email: "", phone: "12" },
      { requireContact: false }
    );
    assert.equal(badPhone.ok, false);
  });
});
