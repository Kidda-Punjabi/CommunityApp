-- =============================================================================
-- Kidda — Public Foundational Course feedback links (guest, no login)
-- Additive only. Does not change existing Beginners quiz/feedback slugs.
-- =============================================================================

INSERT INTO public.public_form_links (slug, form_type, target_id, label)
VALUES
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'foundational-week-1', 'Foundational Week 1 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'foundational-week-2', 'Foundational Week 2 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'foundational-week-3', 'Foundational Week 3 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'foundational-week-4', 'Foundational Week 4 session feedback')
ON CONFLICT (form_type, target_id) DO NOTHING;

DO $$
DECLARE
  foundational_count INTEGER;
BEGIN
  SELECT count(*) INTO foundational_count
  FROM public.public_form_links
  WHERE form_type = 'feedback'
    AND target_id LIKE 'foundational-week-%';

  IF foundational_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 Foundational public feedback links, found %', foundational_count;
  END IF;
END
$$;
