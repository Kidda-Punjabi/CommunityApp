import { KiddaLogo } from "@/components/branding/kidda-logo";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Kidda",
  description: "How Kidda collects, uses, and protects your personal information.",
};

export default async function PrivacyPage() {
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

        <h1 className="mt-6 font-heading text-3xl font-bold tracking-tight text-zinc-900">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: 22 July 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">Who we are</h2>
            <p>
              Kidda (“we”, “us”) provides Punjabi language learning products and community tools
              at this website. This policy explains what personal information we collect and how we
              use it when you visit the site, create an account, purchase a course, or use the app.
            </p>
            <p>
              For privacy questions, contact{" "}
              <a href="mailto:hello@kidda.app" className="font-medium text-violet-600 hover:text-violet-500">
                hello@kidda.app
              </a>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">
              Information we collect
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-zinc-900">Account details</span> — email address,
                name or display name, and authentication credentials managed via our auth provider
                (Supabase).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Purchase and billing data</span> —
                processed by Stripe. We store purchase/access records linked to your account; card
                details are handled by Stripe, not stored by Kidda.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Learning activity</span> — progress,
                practice results, feedback, and similar in-app usage needed to run courses and
                community features.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Optional media inputs</span> — if you use
                speaking, photo translate, or live translate features, audio or images you submit
                are processed to provide those features (including via third-party AI/speech
                providers).
              </li>
              <li>
                <span className="font-medium text-zinc-900">Tutor calendar connection</span> — if a
                tutor connects Google Calendar, we receive OAuth tokens and calendar data needed to
                schedule and sync lessons.
              </li>
              <li>
                <span className="font-medium text-zinc-900">Technical data</span> — standard
                server/logs and cookie or session data required for login and security.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">How we use it</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>Provide, secure, and improve the Kidda app and courses</li>
              <li>Process payments and unlock purchased access</li>
              <li>Send account-related emails (signup confirmation, password reset, invites)</li>
              <li>Support tutors, scheduling, and community features you choose to use</li>
              <li>Respond to support requests and enforce our terms of use</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">
              Processors and third parties
            </h2>
            <p>We use trusted providers to operate the product, including:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Supabase (authentication and database)</li>
              <li>Stripe (payments)</li>
              <li>Vercel (hosting)</li>
              <li>Speech and AI providers used for translate / practice features</li>
              <li>Google (tutor calendar OAuth, when connected)</li>
            </ul>
            <p>
              These providers process data on our behalf under their own privacy terms. We do not
              sell your personal information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">Retention</h2>
            <p>
              We keep account and purchase records for as long as your account is active and as
              needed for legal, tax, and dispute purposes. You can request deletion of your account
              data by contacting us at the email above; some records may be retained where we are
              legally required to keep them.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">Your rights</h2>
            <p>
              Depending on where you live, you may have rights to access, correct, export, or delete
              personal data we hold about you, or to object to certain processing. Contact{" "}
              <a href="mailto:hello@kidda.app" className="font-medium text-violet-600 hover:text-violet-500">
                hello@kidda.app
              </a>{" "}
              to make a request.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">Changes</h2>
            <p>
              We may update this policy from time to time. The “Last updated” date at the top will
              change when we do. Continued use of Kidda after an update means you accept the revised
              policy.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
