-- =============================================================================
-- Kidda — Formal flashcard sets (replaces deck_name-only grouping)
-- Run the ENTIRE file in Supabase SQL Editor
-- Prerequisite: supabase/admin-rls.sql, supabase/flashcards-master.sql (optional)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. flashcard_sets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flashcard_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flashcard_sets_name_not_blank CHECK (btrim(name) <> '')
);

CREATE INDEX IF NOT EXISTS idx_flashcard_sets_name
  ON public.flashcard_sets (name);

CREATE OR REPLACE FUNCTION public.set_flashcard_sets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flashcard_sets_updated_at ON public.flashcard_sets;
CREATE TRIGGER flashcard_sets_updated_at
  BEFORE UPDATE ON public.flashcard_sets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_flashcard_sets_updated_at();

-- -----------------------------------------------------------------------------
-- 2. flashcards.deck_id
-- -----------------------------------------------------------------------------
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS deck_id UUID REFERENCES public.flashcard_sets (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id
  ON public.flashcards (deck_id);

-- -----------------------------------------------------------------------------
-- 3. Migrate distinct deck_name values → flashcard_sets rows
-- -----------------------------------------------------------------------------
INSERT INTO public.flashcard_sets (name)
SELECT DISTINCT btrim(f.deck_name)
FROM public.flashcards AS f
WHERE f.deck_name IS NOT NULL
  AND btrim(f.deck_name) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.flashcard_sets AS s
    WHERE s.name = btrim(f.deck_name)
  );

UPDATE public.flashcards AS f
SET deck_id = s.id
FROM public.flashcard_sets AS s
WHERE f.deck_id IS NULL
  AND f.deck_name IS NOT NULL
  AND btrim(f.deck_name) = s.name;

-- -----------------------------------------------------------------------------
-- 4. set_course_links
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.set_course_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID NOT NULL REFERENCES public.flashcard_sets (id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses (id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT set_course_links_target_check CHECK (
    course_id IS NOT NULL OR lesson_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_set_course_links_deck_id
  ON public.set_course_links (deck_id);

CREATE INDEX IF NOT EXISTS idx_set_course_links_course_id
  ON public.set_course_links (course_id)
  WHERE course_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_set_course_links_lesson_id
  ON public.set_course_links (lesson_id)
  WHERE lesson_id IS NOT NULL;

-- Backfill lesson links from legacy flashcards.lesson_id
INSERT INTO public.set_course_links (deck_id, lesson_id, course_id)
SELECT DISTINCT
  f.deck_id,
  f.lesson_id,
  l.course_id
FROM public.flashcards AS f
JOIN public.lessons AS l ON l.id = f.lesson_id
WHERE f.deck_id IS NOT NULL
  AND f.lesson_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.set_course_links AS scl
    WHERE scl.deck_id = f.deck_id
      AND scl.lesson_id = f.lesson_id
  );

-- -----------------------------------------------------------------------------
-- 5. Row Level Security
-- -----------------------------------------------------------------------------
ALTER TABLE public.flashcard_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_course_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read flashcard_sets" ON public.flashcard_sets;
CREATE POLICY "Public read flashcard_sets"
  ON public.flashcard_sets FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert flashcard_sets" ON public.flashcard_sets;
CREATE POLICY "Admins can insert flashcard_sets"
  ON public.flashcard_sets FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update flashcard_sets" ON public.flashcard_sets;
CREATE POLICY "Admins can update flashcard_sets"
  ON public.flashcard_sets FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete flashcard_sets" ON public.flashcard_sets;
CREATE POLICY "Admins can delete flashcard_sets"
  ON public.flashcard_sets FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Public read set_course_links" ON public.set_course_links;
CREATE POLICY "Public read set_course_links"
  ON public.set_course_links FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can insert set_course_links" ON public.set_course_links;
CREATE POLICY "Admins can insert set_course_links"
  ON public.set_course_links FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update set_course_links" ON public.set_course_links;
CREATE POLICY "Admins can update set_course_links"
  ON public.set_course_links FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete set_course_links" ON public.set_course_links;
CREATE POLICY "Admins can delete set_course_links"
  ON public.set_course_links FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- 6. Grants
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.flashcard_sets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flashcard_sets TO authenticated;
GRANT ALL ON public.flashcard_sets TO service_role;

GRANT SELECT ON public.set_course_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.set_course_links TO authenticated;
GRANT ALL ON public.set_course_links TO service_role;

NOTIFY pgrst, 'reload schema';
