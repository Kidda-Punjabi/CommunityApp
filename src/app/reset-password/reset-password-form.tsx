"use client";

import { PasswordInput } from "@/components/auth/password-input";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Status = "verifying" | "ready" | "done" | "error";

export function ResetPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();

  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function initializeRecovery() {
      const queryError = searchParams.get("error_description");
      if (queryError) {
        if (!isActive) return;
        setStatus("error");
        setErrorMessage(decodeURIComponent(queryError.replace(/\+/g, " ")));
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        if (!isActive) return;
        setStatus("ready");
        return;
      }

      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const code = searchParams.get("code");

      try {
        if (tokenHash && type === "recovery") {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (error) throw error;
          if (!isActive) return;
          setStatus("ready");
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          if (!isActive) return;
          setStatus("ready");
          return;
        }

        const hash = new URLSearchParams(window.location.hash.replace("#", ""));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          if (!isActive) return;
          setStatus("ready");
          return;
        }

        if (!isActive) return;
        setStatus("error");
        setErrorMessage("Reset link is invalid or expired. Please request a new one.");
      } catch (error) {
        if (!isActive) return;
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify reset link. Please try again."
        );
      }
    }

    initializeRecovery();

    return () => {
      isActive = false;
    };
  }, [searchParams, supabase]);

  async function handleSubmit(formData: FormData) {
    const password = (formData.get("password") as string) ?? "";
    const confirmPassword = (formData.get("confirm_password") as string) ?? "";

    if (!password || !confirmPassword) {
      setErrorMessage("Please fill in both password fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setPending(true);
    setErrorMessage("");

    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setStatus("done");
    setSuccessMessage("Password updated. Taking you to your dashboard…");
    router.replace("/dashboard/home");
  }

  if (status === "verifying") {
    return <p className="text-sm text-zinc-500">Verifying your reset link…</p>;
  }

  if (status === "error") {
    return (
      <div className="space-y-4">
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
        <a
          href="/forgot-password"
          className="inline-block text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          Request a new reset link
        </a>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <PasswordInput
        id="password"
        name="password"
        label="New password"
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="At least 6 characters"
      />

      <PasswordInput
        id="confirm_password"
        name="confirm_password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        minLength={6}
        placeholder="Repeat new password"
      />

      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      )}

      {successMessage && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || status === "done"}
        className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Updating password…" : "Update password"}
      </button>
    </form>
  );
}
