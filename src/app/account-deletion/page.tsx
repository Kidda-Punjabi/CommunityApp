import { KiddaLogo } from "@/components/branding/kidda-logo";
import { ui } from "@/lib/ui/styles";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your Kidda account",
  description: "How to delete a Kidda account and what happens to your data.",
};

export default function AccountDeletionPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-violet-50 via-white to-zinc-50">
      <header className="border-b border-violet-100/80 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <KiddaLogo variant="logo" size="sm" />
          </Link>
          <Link href="/login" className="text-sm font-medium text-violet-600">
            Sign in
          </Link>
        </div>
      </header>

      <main className={`mx-auto max-w-2xl ${ui.page} pb-16`}>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">
          Delete your account
        </h1>
        <div className="mt-8 space-y-8 text-sm leading-relaxed text-zinc-700">
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">In the app</h2>
            <p>Open Profile, then Delete account, and confirm. You need to be signed in.</p>
          </section>
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">On the web</h2>
            <p>
              Sign in at{" "}
              <Link href="/login" className="font-medium text-violet-600 hover:text-violet-500">
                webapp.kidda.app
              </Link>
              , then open{" "}
              <Link
                href="/dashboard/profile/delete"
                className="font-medium text-violet-600 hover:text-violet-500"
              >
                Delete account
              </Link>
              .
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">By email</h2>
            <p>
              Email{" "}
              <a href="mailto:hello@kidda.app" className="font-medium text-violet-600 hover:text-violet-500">
                hello@kidda.app
              </a>{" "}
              from the address on the account and ask us to delete it.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">What is deleted</h2>
            <p>This permanently deletes your Kidda login and the personal data stored with it.</p>
            <p>
              That includes kid profiles, homework, forum posts, notifications, streaks, and files
              such as recordings and photos.
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold text-zinc-900">What is kept</h2>
            <p>
              We keep account and purchase records for as long as your account is active and as
              needed for legal, tax, and dispute purposes. Payment records the business has to keep
              are unlinked from you. They are no longer attached to this account. Active
              subscriptions are cancelled. Some records may be retained where we are legally
              required to keep them.
            </p>
            <p>
              This uses the same wording as the{" "}
              <Link href="/privacy" className="font-medium text-violet-600 hover:text-violet-500">
                privacy policy
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
