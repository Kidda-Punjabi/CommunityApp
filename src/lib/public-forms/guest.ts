export type GuestIdentity = {
  fullName: string;
  email: string;
  phone: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateGuestIdentity(input: {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
}): { ok: true; identity: GuestIdentity } | { ok: false; error: string } {
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const phoneRaw = typeof input.phone === "string" ? input.phone.trim() : "";

  if (!fullName) {
    return { ok: false, error: "Please enter your name." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const phone = normalizeGuestPhone(phoneRaw);
  if (!phone) {
    return {
      ok: false,
      error: "Please enter a phone number with 7 to 15 digits (optional leading +).",
    };
  }

  return { ok: true, identity: { fullName, email, phone } };
}

/** Digits with optional leading +; 7–15 digits. Returns canonical +digits or digits. */
export function normalizeGuestPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const plus = trimmed.startsWith("+");
  const digits = (plus ? trimmed.slice(1) : trimmed).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return plus ? `+${digits}` : digits;
}
