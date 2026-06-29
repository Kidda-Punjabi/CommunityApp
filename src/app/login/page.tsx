import { AuthCard } from "@/components/auth-card";
import { ContinueAsUserCard } from "@/components/auth/continue-as-user-card";
import { getContinueAsUser } from "@/lib/auth/continue-as-user";
import Link from "next/link";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams: Promise<{ message?: string; email?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, email: emailParam, next } = await searchParams;
  const continueAs = await getContinueAsUser();
  const rememberedEmail = continueAs?.email ?? emailParam?.trim() ?? "";
  const showRememberedLogin =
    !continueAs?.sessionActive && Boolean(rememberedEmail && continueAs);

  return (
    <AuthCard
      title={continueAs?.sessionActive ? "You're signed in" : "Welcome back"}
      subtitle={
        continueAs?.sessionActive
          ? "Pick up where you left off"
          : showRememberedLogin
            ? "Enter your password to continue"
            : "Sign in to your Kidda account"
      }
      footer={{
        text: "Don't have an account?",
        linkText: "Sign up",
        href: "/signup",
      }}
    >
      {message && (
        <p className="mb-5 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>
      )}

      {continueAs?.sessionActive ? (
        <ContinueAsUserCard user={continueAs} variant="auth" />
      ) : (
        <>
          {showRememberedLogin && continueAs ? (
            <div className="mb-6">
              <ContinueAsUserCard user={continueAs} variant="auth" showSwitchLink={false} />
            </div>
          ) : null}

          {!continueAs?.sessionActive ? (
            <LoginForm
              defaultEmail={showRememberedLogin ? rememberedEmail : undefined}
              rememberedAccount={showRememberedLogin}
              nextPath={next}
            />
          ) : null}

          {showRememberedLogin ? (
            <p className="mt-4 text-center text-sm text-zinc-500">
              <Link href="/login/switch" className="font-medium text-violet-600 hover:text-violet-500">
                Use another account
              </Link>
            </p>
          ) : null}
        </>
      )}
    </AuthCard>
  );
}
