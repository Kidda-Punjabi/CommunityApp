import { AuthCard } from "@/components/auth-card";
import { CheckEmailPanel } from "@/components/auth/check-email-panel";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ email?: string }>;
};

export default async function SignupCheckEmailPage({ searchParams }: PageProps) {
  const { email } = await searchParams;
  const normalized = email?.trim() ?? "";
  if (!normalized || !normalized.includes("@")) {
    redirect("/signup");
  }

  return (
    <AuthCard
      title="Almost there"
      subtitle="Confirm your email before signing in"
      footer={{
        text: "Wrong email?",
        linkText: "Sign up again",
        href: "/signup",
      }}
    >
      <CheckEmailPanel email={normalized} />
    </AuthCard>
  );
}
