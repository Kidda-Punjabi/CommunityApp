-- =============================================================================
-- Kidda — Public backlog quiz + feedback links (guest, no login)
-- Additive only. Service-role access; no anon/authenticated policies.
-- =============================================================================

ALTER TABLE public.feedback_submissions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.feedback_submissions
  ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.feedback_submissions.is_guest IS
  'True for public /p/[slug] submissions with no app account.';

CREATE TABLE IF NOT EXISTS public.public_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  quiz_id UUID NOT NULL REFERENCES public.quizzes (id) ON DELETE RESTRICT,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_quiz_attempts_quiz_id
  ON public.public_quiz_attempts (quiz_id, submitted_at DESC);

ALTER TABLE public.public_quiz_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.public_quiz_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_quiz_attempts TO service_role;

CREATE TABLE IF NOT EXISTS public.public_form_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  form_type TEXT NOT NULL CHECK (form_type IN ('quiz', 'feedback')),
  target_id TEXT NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_type, target_id)
);

ALTER TABLE public.public_form_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.public_form_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.public_form_links TO service_role;

-- 14 Beginners recap + checkpoint quizzes
INSERT INTO public.public_form_links (slug, form_type, target_id, label)
SELECT
  encode(gen_random_bytes(16), 'hex'),
  'quiz',
  q.id::text,
  q.title
FROM public.quizzes q
JOIN public.courses c ON c.id = q.course_id
WHERE c.name = 'Beginners Course'
  AND (
    q.title ~ '^Week ([1-9]|1[01]) Recap Quiz$'
    OR q.title IN (
      'Weeks 1-4 Checkpoint Quiz',
      'Weeks 5-7 Checkpoint Quiz',
      'Weeks 8-10 Checkpoint Quiz'
    )
  )
ON CONFLICT (form_type, target_id) DO NOTHING;

-- 13 feedback targets
INSERT INTO public.public_form_links (slug, form_type, target_id, label)
VALUES
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-1-session', 'Week 1 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-1-starting-point', 'Week 1 starting point'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-2', 'Week 2 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-3', 'Week 3 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-4', 'Week 4 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-5', 'Week 5 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-6', 'Week 6 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-7', 'Week 7 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-8', 'Week 8 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-9', 'Week 9 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-10', 'Week 10 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-11', 'Week 11 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'week-12', 'Week 12 course feedback')
ON CONFLICT (form_type, target_id) DO NOTHING;

DO $$
DECLARE
  quiz_count INTEGER;
  feedback_count INTEGER;
BEGIN
  SELECT count(*) INTO quiz_count
  FROM public.public_form_links
  WHERE form_type = 'quiz';

  SELECT count(*) INTO feedback_count
  FROM public.public_form_links
  WHERE form_type = 'feedback';

  IF quiz_count <> 14 THEN
    RAISE EXCEPTION 'Expected 14 public quiz links, found %', quiz_count;
  END IF;
  IF feedback_count <> 13 THEN
    RAISE EXCEPTION 'Expected 13 public feedback links, found %', feedback_count;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
