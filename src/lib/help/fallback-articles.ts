import type { HelpArticleRow } from "@/lib/help/articles";

/**
 * Mirrors supabase/help-articles.sql seed content so Help Centre stays available
 * if the table has not been applied yet. Prefer DB rows once the migration is live.
 */
export const FALLBACK_HELP_ARTICLES: HelpArticleRow[] = [
  {
    id: "fallback-cancellations-refunds",
    slug: "cancellations-refunds",
    category: "cancellations",
    title: "Cancellations & Refunds",
    summary:
      "How payments, missed sessions, and cancellations work for group and 1–1 lessons.",
    sortOrder: 10,
    bodyMarkdown: `
## Paying for your place

All sessions — whether 1–1 or group — must be paid in advance via Stripe. Payment confirms your place on the course.

## Refunds

Once a course has begun, payments are **non-refundable**.

If you need to cancel **before** a course starts, a refund may be considered at Kidda’s discretion. We look at each request individually.

Payments cannot be transferred between different courses or participants.

## Group lessons

If you miss a group class, your tutor will share a recap or notes so you can catch up. Missed group sessions **cannot be rescheduled or refunded**.

If you know you can’t attend a scheduled group session, please give us at least **7 days’ notice**. Where we can, we’ll try to offer an alternative session in the same week — subject to availability.

## 1–1 lessons

You can reschedule a 1–1 lesson with **48 hours’ notice**.

If you cancel within 48 hours of your lesson, that session is **non-refundable** and counts as used. You can take Session catch-up instead of a live move, or pay a rebooking fee when that option is available.

## Late or failed payments

Late or failed payments may result in your access being paused or revoked until payment is resolved.

## Still unsure?

If your situation isn’t covered here, use **Got another question?** below to email the team.
`.trim(),
  },
  {
    id: "fallback-changing-cohorts",
    slug: "changing-cohorts",
    category: "cohorts",
    title: "Can I switch to a different cohort?",
    summary:
      "Why permanent cohort transfers aren’t generally available, and what to do in rare extenuating cases.",
    sortOrder: 20,
    bodyMarkdown: `
## Once your cohort has started

Once a cohort has started, you are **not permitted to permanently transfer** to a different cohort. Your booking is tied to the cohort you joined.

If a tutor sometimes lets you sit in on another group for a single session, that is a temporary arrangement only — it is **not** a permanent cohort change.

## Why we don’t move people between cohorts

Cohorts are planned and priced around a stable group. Seats, schedules, and tutor time are fixed for that group. Moving someone mid-course isn’t something we can generally accommodate, and doing so often costs Kidda more than the seat is worth.

## Extenuating circumstances

In genuine extenuating circumstances, Kidda **may** consider a change at its discretion. This is:

- **Not guaranteed**
- Assessed **case by case**
- May involve a **fee**

If you believe your situation qualifies, contact us directly — speak to your tutor, or email **hello@kidda.app** and explain what’s going on. There is no self-serve button to request a permanent cohort transfer.

## Still unsure?

Use **Got another question?** below to reach the team.
`.trim(),
  },
];
