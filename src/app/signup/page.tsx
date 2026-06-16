import { AuthCard } from "@/components/auth-card";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <AuthCard
      title="Join Kidda"
      subtitle="Create your account to get started"
      footer={{
        text: "Already have an account?",
        linkText: "Sign in",
        href: "/login",
      }}
    >
      <SignupForm />
    </AuthCard>
  );
}
