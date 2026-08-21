import { BookCallWidget } from "@/components/booking/book-call-widget";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Book a call | Kidda",
  description: "Schedule a free call with the Kidda team to find the right Punjabi course for you.",
};

export default async function BookCallPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const backHref = user ? "/dashboard/profile" : "/how-it-works";
  const backLabel = user ? "← Back to profile" : "← Back to how it works";

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
        <Link href={backHref} className="text-sm font-medium text-violet-600 hover:text-violet-500">
          {backLabel}
        </Link>

        <div className="mt-6 text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">
            Book a call
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
            Pick a time that works for you. Our team will help you choose the right course and
            answer any questions.
          </p>
        </div>

        <BookCallWidget className="mt-8 overflow-hidden rounded-3xl border border-zinc-200/60 bg-white shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]" />
      </main>
    </div>
  );
}
