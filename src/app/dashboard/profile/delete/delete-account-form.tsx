"use client";

import { useActionState } from "react";
import { deleteAccount, type DeleteAccountState } from "./actions";

const initial: DeleteAccountState = {};

export function DeleteAccountForm({ blockedReason }: { blockedReason: string | null }) {
  const [state, action, pending] = useActionState(deleteAccount, initial);

  if (blockedReason) {
    return (
      <p className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 text-sm text-zinc-700">
        {blockedReason}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white px-4 py-5">
      <label htmlFor="confirmation" className="block text-sm font-medium text-zinc-800">
        Type DELETE to confirm
      </label>
      <input
        id="confirmation"
        name="confirmation"
        autoComplete="off"
        autoCapitalize="characters"
        className="block w-full rounded-xl border border-zinc-300 px-3 py-3 text-zinc-900"
        placeholder="DELETE"
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
