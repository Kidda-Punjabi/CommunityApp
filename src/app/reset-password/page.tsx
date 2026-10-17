import { AuthCard } from "@/components/auth-card";
import { InlineSpinner } from "@/components/ui/page-spinner";
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
      <Suspense fallback={<div className="flex justify-center py-4"><InlineSpinner /></div>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  );
}
