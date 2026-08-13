-- =============================================================================
-- Kidda — Help Centre articles (policies & FAQs backed by the database)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.help_articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  category      TEXT NOT NULL,
  title         TEXT NOT NULL,
  summary       TEXT,
  body_markdown TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.help_articles IS
  'Published Help Centre articles (cancellations, cohorts, etc.). Read by authenticated members; written by master_admin only.';

CREATE INDEX IF NOT EXISTS idx_help_articles_published_sort
  ON public.help_articles (is_published, category, sort_order);

CREATE OR REPLACE FUNCTION public.help_articles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_help_articles_set_updated_at ON public.help_articles;
CREATE TRIGGER trg_help_articles_set_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.help_articles_set_updated_at();

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read published help articles" ON public.help_articles;
CREATE POLICY "Authenticated read published help articles"
  ON public.help_articles FOR SELECT TO authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Master admins manage help articles" ON public.help_articles;
CREATE POLICY "Master admins manage help articles"
  ON public.help_articles FOR ALL TO authenticated
  USING (public.is_master_admin())
  WITH CHECK (public.is_master_admin());

GRANT SELECT ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;

-- ---------------------------------------------------------------------------
-- Seed: Cancellations & Refunds + Changing cohorts
-- ---------------------------------------------------------------------------

INSERT INTO public.help_articles (slug, category, title, summary, body_markdown, sort_order, is_published)
VALUES
(
  'cancellations-refunds',
  'cancellations',
  'Cancellations & Refunds',
  'How payments, missed sessions, and cancellations work for group and 1–1 lessons.',
  $md$
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

You can reschedule a 1–1 lesson with **24 hours’ notice**.

If you cancel within 24 hours of your lesson, that session is **non-refundable** and counts as used.

## Late or failed payments

Late or failed payments may result in your access being paused or revoked until payment is resolved.

## Still unsure?

If your situation isn’t covered here, use **Got another question?** below to email the team.
$md$,
  10,
  true
),
(
  'changing-cohorts',
  'cohorts',
  'Can I switch to a different cohort?',
  'Why permanent cohort transfers aren’t generally available, and what to do in rare extenuating cases.',
  $md$
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
$md$,
  20,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_markdown = EXCLUDED.body_markdown,
  sort_order = EXCLUDED.sort_order,
  is_published = EXCLUDED.is_published,
  updated_at = now();

NOTIFY pgrst, 'reload schema';
