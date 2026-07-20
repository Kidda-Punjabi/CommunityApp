"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { login, type AuthState } from "./actions";

const initialState: AuthState = {};

type LoginFormProps = {
  defaultEmail?: string;
  /** When set, email is fixed (remembered account) and only password is shown. */
  rememberedAccount?: boolean;
  nextPath?: string;
};

export function LoginForm({ defaultEmail, rememberedAccount = false, nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      {rememberedAccount && defaultEmail ? (
        <input type="hidden" name="email" value={defaultEmail} />
      ) : (
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={defaultEmail}
            className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            placeholder="you@example.com"
          />
        </div>
      )}

      <PasswordInput
        id="password"
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        autoFocus={rememberedAccount}
        placeholder="••••••••"
        footer={
          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-violet-600 hover:text-violet-500"
            >
              Forgot password?
            </Link>
          </div>
        }
      />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing in…" : rememberedAccount ? "Continue" : "Sign in"}
      </button>
    </form>
  );
}
