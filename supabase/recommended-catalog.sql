-- =============================================================================
-- Kidda — Recommended media, recipes, and tutor favorites
-- Apply via: SUPABASE_ACCESS_TOKEN=... npx tsx scripts/apply-recommended-catalog.ts
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.recommended_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_type text NOT NULL CHECK (media_type IN ('movie', 'book')),
  content_track text NOT NULL CHECK (content_track IN ('kids', 'adult')),
  title text NOT NULL,
  creator text,
  cefr_level text,
  description text,
  where_to_find text,
  age_appropriate_note text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recommended_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  punjabi_name text,
  description text,
  difficulty text CHECK (difficulty IN ('easy', 'medium', 'hard')),
  prep_time_minutes int,
  external_link text,
  content_track text NOT NULL CHECK (content_track IN ('kids', 'adult')),
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- XOR between media_id and recipe_id, same style as certificates.profile_id/kid_profile_id.
CREATE TABLE IF NOT EXISTS public.tutor_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES public.profiles (id),
  media_id uuid REFERENCES public.recommended_media (id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recommended_recipes (id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tutor_favorites_xor CHECK (
    (media_id IS NOT NULL AND recipe_id IS NULL)
    OR (media_id IS NULL AND recipe_id IS NOT NULL)
  ),
  CONSTRAINT tutor_favorites_unique_media UNIQUE (tutor_id, media_id),
  CONSTRAINT tutor_favorites_unique_recipe UNIQUE (tutor_id, recipe_id)
);

CREATE INDEX IF NOT EXISTS idx_recommended_media_active_order
  ON public.recommended_media (content_track, display_order, title)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recommended_recipes_active_order
  ON public.recommended_recipes (content_track, display_order, title)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_tutor_favorites_tutor_id
  ON public.tutor_favorites (tutor_id);

CREATE OR REPLACE FUNCTION public.recommended_catalog_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recommended_media_set_updated_at ON public.recommended_media;
CREATE TRIGGER trg_recommended_media_set_updated_at
  BEFORE UPDATE ON public.recommended_media
  FOR EACH ROW EXECUTE FUNCTION public.recommended_catalog_set_updated_at();

DROP TRIGGER IF EXISTS trg_recommended_recipes_set_updated_at ON public.recommended_recipes;
CREATE TRIGGER trg_recommended_recipes_set_updated_at
  BEFORE UPDATE ON public.recommended_recipes
  FOR EACH ROW EXECUTE FUNCTION public.recommended_catalog_set_updated_at();

COMMENT ON TABLE public.recommended_media IS
  'Admin-curated movie and book recommendations for Community. Cover images deferred.';

COMMENT ON TABLE public.recommended_recipes IS
  'Admin-curated recipe recommendations for Community.';

COMMENT ON TABLE public.tutor_favorites IS
  'Tutor picks from recommended media or recipes. Exactly one of media_id / recipe_id is set.';

ALTER TABLE public.recommended_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommended_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read active recommended media" ON public.recommended_media;
CREATE POLICY "Authenticated read active recommended media"
  ON public.recommended_media FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins insert recommended media" ON public.recommended_media;
CREATE POLICY "Admins insert recommended media"
  ON public.recommended_media FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update recommended media" ON public.recommended_media;
CREATE POLICY "Admins update recommended media"
  ON public.recommended_media FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete recommended media" ON public.recommended_media;
CREATE POLICY "Admins delete recommended media"
  ON public.recommended_media FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read active recommended recipes" ON public.recommended_recipes;
CREATE POLICY "Authenticated read active recommended recipes"
  ON public.recommended_recipes FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins insert recommended recipes" ON public.recommended_recipes;
CREATE POLICY "Admins insert recommended recipes"
  ON public.recommended_recipes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update recommended recipes" ON public.recommended_recipes;
CREATE POLICY "Admins update recommended recipes"
  ON public.recommended_recipes FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete recommended recipes" ON public.recommended_recipes;
CREATE POLICY "Admins delete recommended recipes"
  ON public.recommended_recipes FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated read tutor favorites" ON public.tutor_favorites;
CREATE POLICY "Authenticated read tutor favorites"
  ON public.tutor_favorites FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Tutors insert own favorites" ON public.tutor_favorites;
CREATE POLICY "Tutors insert own favorites"
  ON public.tutor_favorites FOR INSERT TO authenticated
  WITH CHECK (tutor_id = auth.uid() AND public.is_tutor());

DROP POLICY IF EXISTS "Tutors update own favorites" ON public.tutor_favorites;
CREATE POLICY "Tutors update own favorites"
  ON public.tutor_favorites FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid() AND public.is_tutor())
  WITH CHECK (tutor_id = auth.uid() AND public.is_tutor());

DROP POLICY IF EXISTS "Tutors delete own favorites" ON public.tutor_favorites;
CREATE POLICY "Tutors delete own favorites"
  ON public.tutor_favorites FOR DELETE TO authenticated
  USING (tutor_id = auth.uid() AND public.is_tutor());

GRANT SELECT ON public.recommended_media TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.recommended_media TO authenticated;
GRANT ALL ON public.recommended_media TO service_role;

GRANT SELECT ON public.recommended_recipes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.recommended_recipes TO authenticated;
GRANT ALL ON public.recommended_recipes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_favorites TO authenticated;
GRANT ALL ON public.tutor_favorites TO service_role;

NOTIFY pgrst, 'reload schema';
