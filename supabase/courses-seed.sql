-- =============================================================================
-- Kidda — Ensure standard courses exist (Foundational, Beginners, Community)
-- Prefer courses-dedupe.sql if you already have duplicate rows in admin.
-- =============================================================================

INSERT INTO public.courses (name, description, display_order, required_tier)
SELECT v.name, v.description, v.display_order, v.required_tier
FROM (
  VALUES
    (
      'Foundational Course',
      'Pronunciation, core vocabulary, and everyday phrases.',
      1,
      'foundational'
    ),
    (
      'Beginners Course',
      'Build confidence with guided lessons for early learners.',
      2,
      'beginners'
    ),
    (
      'Kidda Community',
      'Live sessions, advanced content, and the full Kidda community.',
      3,
      'community'
    )
) AS v(name, description, display_order, required_tier)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.courses AS c
  WHERE c.required_tier = v.required_tier
     OR (
       v.required_tier = 'foundational' AND c.name ILIKE '%foundational%'
     )
     OR (
       v.required_tier = 'beginners' AND c.name ILIKE '%beginner%'
     )
     OR (
       v.required_tier = 'community' AND c.name ILIKE '%community%'
     )
);

NOTIFY pgrst, 'reload schema';
