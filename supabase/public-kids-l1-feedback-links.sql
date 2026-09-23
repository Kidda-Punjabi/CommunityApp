-- =============================================================================
-- Kidda — Public Kids Beginners L1 session feedback links (guest, no login)
-- Weeks 1 and 3–12. Week 2 already exists and is not inserted here.
-- Additive only. Does not change existing Beginners or Foundational slugs.
-- =============================================================================

INSERT INTO public.public_form_links (slug, form_type, target_id, label)
VALUES
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-1', 'Kids Beginners L1 Week 1 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-3', 'Kids Beginners L1 Week 3 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-4', 'Kids Beginners L1 Week 4 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-5', 'Kids Beginners L1 Week 5 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-6', 'Kids Beginners L1 Week 6 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-7', 'Kids Beginners L1 Week 7 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-8', 'Kids Beginners L1 Week 8 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-9', 'Kids Beginners L1 Week 9 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-10', 'Kids Beginners L1 Week 10 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-11', 'Kids Beginners L1 Week 11 session feedback'),
  (encode(gen_random_bytes(16), 'hex'), 'feedback', 'kids-l1-week-12', 'Kids Beginners L1 Week 12 session feedback')
ON CONFLICT (form_type, target_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
