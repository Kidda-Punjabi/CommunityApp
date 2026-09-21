-- =============================================================================
-- Kidda — Public Kids Beginners L1 Week 2 session feedback link (guest, no login)
-- Additive only. Does not change existing Beginners or Foundational slugs.
-- =============================================================================

INSERT INTO public.public_form_links (slug, form_type, target_id, label)
VALUES (
  encode(gen_random_bytes(16), 'hex'),
  'feedback',
  'kids-l1-week-2',
  'Kids Beginners L1 Week 2 session feedback'
)
ON CONFLICT (form_type, target_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
