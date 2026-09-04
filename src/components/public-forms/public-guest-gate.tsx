"use client";

import { useState } from "react";
import { validateGuestIdentity, type GuestIdentity } from "@/lib/public-forms/guest";
import { ui } from "@/lib/ui/styles";

type PublicGuestGateProps = {
  onContinue: (identity: GuestIdentity) => void;
};

export function PublicGuestGate({ onContinue }: PublicGuestGateProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = validateGuestIdentity({ fullName, email, phone });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onContinue(result.identity);
  }

  return (
    <form onSubmit={handleSubmit} className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${ui.stack}`}>
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Before you start</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your details so we can match this to your course.
        </p>
      </div>

      <label className="block text-sm font-medium text-zinc-700">
        Full name
        <input
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Phone
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button type="submit" className={ui.btnPrimaryBlock}>
        Continue
      </button>
    </form>
  );
}
