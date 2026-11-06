"use client";

/**
 * Shown in the iOS and Android apps where the website offers a purchase.
 * App Store rules (guideline 3.1.1) don't allow web checkout links for Premium,
 * Community or group courses inside the app, and UK apps can't point people to
 * an outside payment page either. So the copy stays neutral: no link, no price,
 * no mention of where else to buy.
 */
export function NotSoldInApp({ className }: { className?: string }) {
  return (
    <p className={`rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 ${className ?? ""}`}>
      This can&apos;t be bought in the app.
    </p>
  );
}
