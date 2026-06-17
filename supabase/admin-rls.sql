-- =============================================================================
-- Kidda — RLS policies (read + admin write)
-- Run in Supabase SQL Editor if you get:
-- "new row violates row-level security policy for table …"
-- =============================================================================
--
-- Before using admin CMS:
-- 1. Supabase Dashboard → Authentication → Users → your user
-- 2. Raw App Meta Data: {"role": "admin"}
-- 3. Sign out of the app and sign back in (refreshes JWT)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
      AND COALESCE(raw_app_meta_data ->> 'role', '') = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Public read (members / learn pages)
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read courses" ON public.courses;
CREATE POLICY "Public read courses"
  ON public.courses FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read lessons" ON public.lessons;
CREATE POLICY "Public read lessons"
  ON public.lessons FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read quizzes" ON public.quizzes;
CREATE POLICY "Public read quizzes"
  ON public.quizzes FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read quiz_questions" ON public.quiz_questions;
CREATE POLICY "Public read quiz_questions"
  ON public.quiz_questions FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read flashcards" ON public.flashcards;
CREATE POLICY "Public read flashcards"
  ON public.flashcards FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read teachers" ON public.teachers;
CREATE POLICY "Public read teachers"
  ON public.teachers FOR SELECT TO anon, authenticated USING (true);

-- Admin write policies
DROP POLICY IF EXISTS "Admins can insert lessons" ON public.lessons;
CREATE POLICY "Admins can insert lessons"
  ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update lessons" ON public.lessons;
CREATE POLICY "Admins can update lessons"
  ON public.lessons FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete lessons" ON public.lessons;
CREATE POLICY "Admins can delete lessons"
  ON public.lessons FOR DELETE TO authenticated
  USING (public.is_admin());

-- Courses
DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;
CREATE POLICY "Admins can insert courses"
  ON public.courses FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
CREATE POLICY "Admins can update courses"
  ON public.courses FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;
CREATE POLICY "Admins can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (public.is_admin());

-- Quizzes
DROP POLICY IF EXISTS "Admins can insert quizzes" ON public.quizzes;
CREATE POLICY "Admins can insert quizzes"
  ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update quizzes" ON public.quizzes;
CREATE POLICY "Admins can update quizzes"
  ON public.quizzes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete quizzes" ON public.quizzes;
CREATE POLICY "Admins can delete quizzes"
  ON public.quizzes FOR DELETE TO authenticated
  USING (public.is_admin());

-- Quiz questions
DROP POLICY IF EXISTS "Admins can insert quiz_questions" ON public.quiz_questions;
CREATE POLICY "Admins can insert quiz_questions"
  ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update quiz_questions" ON public.quiz_questions;
CREATE POLICY "Admins can update quiz_questions"
  ON public.quiz_questions FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete quiz_questions" ON public.quiz_questions;
CREATE POLICY "Admins can delete quiz_questions"
  ON public.quiz_questions FOR DELETE TO authenticated
  USING (public.is_admin());

-- Flashcards
DROP POLICY IF EXISTS "Admins can insert flashcards" ON public.flashcards;
CREATE POLICY "Admins can insert flashcards"
  ON public.flashcards FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update flashcards" ON public.flashcards;
CREATE POLICY "Admins can update flashcards"
  ON public.flashcards FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete flashcards" ON public.flashcards;
CREATE POLICY "Admins can delete flashcards"
  ON public.flashcards FOR DELETE TO authenticated
  USING (public.is_admin());

-- Teachers
DROP POLICY IF EXISTS "Admins can insert teachers" ON public.teachers;
CREATE POLICY "Admins can insert teachers"
  ON public.teachers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update teachers" ON public.teachers;
CREATE POLICY "Admins can update teachers"
  ON public.teachers FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete teachers" ON public.teachers;
CREATE POLICY "Admins can delete teachers"
  ON public.teachers FOR DELETE TO authenticated
  USING (public.is_admin());

-- Table grants (required in addition to RLS)
GRANT INSERT, UPDATE, DELETE ON public.lessons TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teachers TO authenticated;

NOTIFY pgrst, 'reload schema';
