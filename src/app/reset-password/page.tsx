import { AuthCard } from "@/components/auth-card";
import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a secure password for your Kidda account"
      footer={{
        text: "Back to login?",
        linkText: "Sign in",
        href: "/login",
      }}
    >
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
