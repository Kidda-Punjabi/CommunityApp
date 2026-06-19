-- =============================================================================
-- Kidda — Verb Conjugator: verbs table + population from flashcards
-- Run in Supabase SQL Editor (after flashcards table exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.verbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  infinitive TEXT NOT NULL UNIQUE,
  infinitive_romanised TEXT,
  english TEXT NOT NULL,
  root TEXT NOT NULL,
  root_romanised TEXT,
  root_class TEXT NOT NULL CHECK (root_class IN ('consonant', 'kanaa', 'vowel')),
  is_irregular BOOLEAN NOT NULL DEFAULT false,
  irregular_past_masc_sg TEXT,
  irregular_past_fem_sg TEXT,
  irregular_past_masc_pl TEXT,
  irregular_past_fem_pl TEXT,
  has_tippi_insertion BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  source_flashcard_id UUID REFERENCES public.flashcards (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT verbs_infinitive_not_blank CHECK (btrim(infinitive) <> ''),
  CONSTRAINT verbs_english_not_blank CHECK (btrim(english) <> ''),
  CONSTRAINT verbs_root_not_blank CHECK (btrim(root) <> '')
);

CREATE INDEX IF NOT EXISTS idx_verbs_english ON public.verbs (english);
CREATE INDEX IF NOT EXISTS idx_verbs_root ON public.verbs (root);

-- -----------------------------------------------------------------------------
-- Helper: strip infinitive ending (ਣਾ or ਨਾ)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verb_extract_root(inf TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN inf ~ 'ਣਾ$' THEN regexp_replace(inf, 'ਣਾ$', '')
    WHEN inf ~ 'ਨਾ$' THEN regexp_replace(inf, 'ਨਾ$', '')
    ELSE inf
  END;
$$;

-- -----------------------------------------------------------------------------
-- Helper: classify root (Week 3 Tables 1a/1b/1c)
-- kanaa = ends in ਾ; vowel = ends in ੀ/ੇ/ੈ/ੋ/ੌ; else consonant
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verb_classify_root(root_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN right(root_text, 1) = 'ਾ' THEN 'kanaa'
    WHEN right(root_text, 1) IN ('ੀ', 'ੇ', 'ੈ', 'ੋ', 'ੌ', 'ਓ', 'ਏ') THEN 'vowel'
    ELSE 'consonant'
  END;
$$;

-- -----------------------------------------------------------------------------
-- One-time population (idempotent: skip if verbs already exist)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.verbs LIMIT 1) THEN
    RAISE NOTICE 'verbs table already populated — skipping seed';
    RETURN;
  END IF;

  INSERT INTO public.verbs (
    infinitive,
    english,
    root,
    root_class,
    is_irregular,
    irregular_past_masc_sg,
    irregular_past_fem_sg,
    irregular_past_masc_pl,
    irregular_past_fem_pl,
    has_tippi_insertion,
    notes,
    source_flashcard_id
  )
  WITH verb_flashcards AS (
    SELECT
      f.id,
      f.front_text,
      f.back_text,
      -- Prefer canonical English for known synonym collisions
      ROW_NUMBER() OVER (
        PARTITION BY f.back_text
        ORDER BY
          CASE f.back_text
            WHEN 'ਸ਼ੁਰੂ ਕਰਨਾ' THEN CASE WHEN f.front_text ILIKE 'to start%' THEN 0 ELSE 1 END
            WHEN 'ਪੜ੍ਹਨਾ' THEN CASE WHEN f.front_text ILIKE 'to read%' THEN 0 ELSE 1 END
            WHEN 'ਰਹਿਣਾ' THEN CASE WHEN f.front_text ILIKE 'to live%' AND f.front_text NOT ILIKE '%reside%' THEN 0 ELSE 1 END
            ELSE 0
          END,
          f.created_at NULLS LAST,
          f.id
      ) AS rn
    FROM public.flashcards f
    WHERE f.front_text ILIKE 'to %'
      AND btrim(f.back_text) <> ''
  ),
  deduped AS (
    SELECT id, front_text, back_text
    FROM verb_flashcards
    WHERE rn = 1
  )
  SELECT
    d.back_text,
    lower(btrim(d.front_text)),
    public.verb_extract_root(d.back_text),
    public.verb_classify_root(public.verb_extract_root(d.back_text)),
    false,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    false,
    NULL::TEXT,
    d.id
  FROM deduped d;

  -- Irregular past overrides + tippi insertion (only where verb exists in seed)
  UPDATE public.verbs SET
    is_irregular = true,
    irregular_past_masc_sg = v.m,
    irregular_past_fem_sg = v.f,
    irregular_past_masc_pl = v.mp,
    irregular_past_fem_pl = v.fp,
    has_tippi_insertion = COALESCE(v.tippi, false),
    notes = v.note
  FROM (VALUES
    ('ਜਾਣਾ', 'ਗਿਆ', 'ਗਈ', 'ਗਏ', 'ਗਈਆਂ', false, 'Irregular simple past'),
    ('ਖਾਣਾ', 'ਖਾਧਾ', 'ਖਾਧੀ', 'ਖਾਧੇ', 'ਖਾਧੀਆਂ', false, 'Irregular simple past'),
    ('ਕਰਨਾ', 'ਕੀਤਾ', 'ਕੀਤੀ', 'ਕੀਤੇ', 'ਕੀਤੀਆਂ', false, 'Irregular simple past'),
    ('ਆਉਣਾ', 'ਆਇਆ', 'ਆਈ', 'ਆਏ', 'ਆਈਆਂ', false, 'Irregular simple past'),
    ('ਦੇਣਾ', 'ਦਿੱਤਾ', 'ਦਿੱਤੀ', 'ਦਿੱਤੇ', 'ਦਿੱਤੀਆਂ', false, 'Irregular simple past; present habitual uses ਦਿੰਦਾ'),
    ('ਪੀਣਾ', 'ਪੀਤਾ', 'ਪੀਤੀ', 'ਪੀਤੇ', 'ਪੀਤੀਆਂ', false, 'Irregular simple past'),
    ('ਲੈਣਾ', 'ਲਿਆ', 'ਲਈ', 'ਲਏ', 'ਲਈਆਂ', false, 'Irregular simple past'),
    ('ਕਹਿਣਾ', 'ਕਿਹਾ', 'ਕਹੀ', 'ਕਹੇ', 'ਕਹੀਆਂ', true, 'Irregular simple past; tippi in habitual'),
    ('ਦੇਖਣਾ', 'ਦੇਖਿਆ', 'ਦੇਖੀ', 'ਦੇਖੇ', 'ਦੇਖੀਆਂ', false, 'Irregular simple past'),
    ('ਲੱਗਣਾ', 'ਲੱਗਿਆ', 'ਲੱਗੀ', 'ਲੱਗੇ', 'ਲੱਗੀਆਂ', false, 'Irregular simple past'),
    ('ਹੋਣਾ', NULL, NULL, NULL, NULL, true, 'Present habitual: ਹੁੰਦਾ; tippi insertion'),
    ('ਰਹਿਣਾ', NULL, NULL, NULL, NULL, true, 'Present habitual: ਰਹਿੰਦਾ; tippi insertion')
  ) AS v(inf, m, f, mp, fp, tippi, note)
  WHERE verbs.infinitive = v.inf;

  -- Mark purely tippi verbs as irregular only when they have no past overrides
  UPDATE public.verbs SET is_irregular = true
  WHERE infinitive IN ('ਹੋਣਾ', 'ਰਹਿਣਾ', 'ਕਹਿਣਾ');

  RAISE NOTICE 'verbs table populated with % rows', (SELECT count(*) FROM public.verbs);
END $$;

-- -----------------------------------------------------------------------------
-- RLS: public read (reference tool, no tier gate)
-- -----------------------------------------------------------------------------
ALTER TABLE public.verbs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read verbs" ON public.verbs;
CREATE POLICY "Public read verbs"
  ON public.verbs FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.verbs TO anon, authenticated;
GRANT ALL ON public.verbs TO service_role;

NOTIFY pgrst, 'reload schema';
