import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams;

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Kidda account"
      footer={{
        text: "Don't have an account?",
        linkText: "Sign up",
        href: "/signup",
      }}
    >
      {message && (
        <p className="mb-5 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}
      <LoginForm />
    </AuthCard>
  );
}
