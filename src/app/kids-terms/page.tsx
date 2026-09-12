import { KiddaLogo } from "@/components/branding/kidda-logo";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Kids course terms | Kidda",
  description: "Terms for Kidda kids courses. Legal copy pending.",
  robots: { index: false, follow: false },
};

export default async function KidsTermsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 via-white to-zinc-50">
      <header className="border-b border-violet-100/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href={user ? "/dashboard/learn" : "/"} className="flex items-center gap-2">
            <KiddaLogo variant="logo" size="sm" />
          </Link>
          {user ? (
            <Link href="/dashboard/learn" className="text-sm font-medium text-violet-600">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-medium text-violet-600">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className={`mx-auto max-w-2xl ${ui.page} pb-16`}>
        <Link
          href={user ? "/dashboard/learn" : "/"}
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back
        </Link>

        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Terms content pending — do not treat as final</p>
          <p className="mt-1">
            This page is a placeholder for dedicated kids-course terms. It is not approved legal
            copy. Real content needs to come from Gurupma before this can be considered done.
          </p>
        </div>

        <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight text-zinc-900">
          Kids course terms
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Placeholder — not in force</p>

        <div className="mt-8 space-y-4 text-sm leading-relaxed text-zinc-600">
          <p>
            Approved terms for creating a kid profile and enrolling a child in a Kidda course will
            appear here. Until then, do not treat anything on this page as a contract or policy.
          </p>
          <p>
            Questions:{" "}
            <a href="mailto:hello@kidda.app" className="font-medium text-violet-600 hover:text-violet-500">
              hello@kidda.app
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
