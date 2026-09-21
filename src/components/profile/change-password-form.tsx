"use client";

import { PasswordInput } from "@/components/auth/password-input";
import { BackLink } from "@/components/navigation/back-link";
import { passwordUpdateErrorMessage, validateNewPassword } from "@/lib/auth/password-update-error";
import { createClient } from "@/lib/supabase/client";
import { ui } from "@/lib/ui/styles";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

export function ChangePasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const canSubmit =
    password.length > 0 && confirmPassword.length > 0 && !pending && !success;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateNewPassword(password, confirmPassword);
    setPasswordError(validation.passwordError ?? "");
    setConfirmError(validation.confirmError ?? "");
    setFormError("");

    if (validation.passwordError || validation.confirmError) {
      return;
    }

    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (error) {
      setFormError(passwordUpdateErrorMessage(error));
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
    window.setTimeout(() => {
      router.replace("/dashboard/profile?passwordUpdated=1");
      router.refresh();
    }, 600);
  }

  return (
    <div className={`${ui.page} ${ui.stackLoose}`}>
      <div>
        <BackLink fallbackHref="/dashboard/profile" className="text-sm font-medium text-violet-600">
          ← Profile
        </BackLink>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Change password</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${ui.card} space-y-5`}>
        <PasswordInput
          id="new_password"
          name="new_password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          footer={
            <>
              <p className="mt-1.5 text-sm text-zinc-500">At least 6 characters</p>
              {passwordError ? (
                <p className="mt-1.5 text-sm text-red-600">{passwordError}</p>
              ) : null}
            </>
          }
        />

        <PasswordInput
          id="confirm_password"
          name="confirm_password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          footer={
            confirmError || formError ? (
              <p className="mt-1.5 text-sm text-red-600">{confirmError || formError}</p>
            ) : null
          }
        />

        {success ? (
          <p className="text-sm text-green-700">Password updated</p>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className={`${ui.btnPrimaryBlock} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending ? "Updating password…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
