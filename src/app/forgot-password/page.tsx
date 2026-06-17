import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="Enter your email and we will send you a reset link"
      footer={{
        text: "Remembered your password?",
        linkText: "Back to sign in",
        href: "/login",
      }}
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
