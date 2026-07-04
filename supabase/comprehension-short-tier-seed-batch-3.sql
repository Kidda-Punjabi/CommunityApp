-- =============================================================================
-- Kidda — Comprehension Practice seed (Short tier, batch 3)
-- Run in Supabase SQL Editor AFTER:
--   comprehension-practice.sql
--   comprehension-paragraphs-tier.sql
--
-- Idempotent: deletes scripts by title, then re-inserts (scripts 7–9).
-- NOT the same as scripts/seed-comprehension-batch-*.ts — those are Node seeds.
-- =============================================================================

DELETE FROM public.comprehension_scripts
WHERE title IN (
  'Describing your home',
  'Talking about a pet',
  'Asking for directions'
);

DO $$
DECLARE
  script_id UUID;
  paragraph_id UUID;
BEGIN
  -- -------------------------------------------------------------------------
  -- Script 7: Describing your home
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Describing your home',
    'Draft — pending native speaker review. Present-tense home description. Access: free.',
    'short', 2, 7, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਮੇਰਾ ਘਰ ਛੋਟਾ ਪਰ ਸੋਹਣਾ ਹੈ।', 'Mera ghar chota par sohna hai.', 'My home is small but beautiful.'),
    (script_id, paragraph_id, 2, 'ਇਸ ਵਿੱਚ ਤਿੰਨ ਕਮਰੇ ਹਨ।', 'Is vich tinn kamre han.', 'It has three rooms.'),
    (script_id, paragraph_id, 3, 'ਰਸੋਈ ਬਹੁਤ ਵੱਡੀ ਹੈ।', 'Rasoi bahut vaddi hai.', 'The kitchen is very big.'),
    (script_id, paragraph_id, 4, 'ਸਾਡੇ ਘਰ ਦੇ ਬਾਹਰ ਇੱਕ ਬਗੀਚਾ ਹੈ।', 'Saade ghar de bahar ik bagicha hai.', 'There''s a garden outside our house.'),
    (script_id, paragraph_id, 5, 'ਮੈਨੂੰ ਆਪਣਾ ਘਰ ਬਹੁਤ ਪਸੰਦ ਹੈ।', 'Mainu apna ghar bahut pasand hai.', 'I like my home a lot.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਘਰ ਵਿੱਚ ਕਿੰਨੇ ਕਮਰੇ ਹਨ? (Ghar vich kinne kamre han?)', 'ਦੋ (do)', 'ਤਿੰਨ (tinn)', 'ਚਾਰ (chaar)', 'ਪੰਜ (panj)', 'b', 0),
    (script_id, 'ਕਿਹੜਾ ਕਮਰਾ ਵੱਡਾ ਹੈ? (Kihra kamra vadda hai?)', 'ਬੈੱਡਰੂਮ (bedroom)', 'ਰਸੋਈ (rasoi)', 'ਬਾਥਰੂਮ (bathroom)', 'ਲਿਵਿੰਗ ਰੂਮ (living room)', 'b', 1),
    (script_id, 'ਘਰ ਦੇ ਬਾਹਰ ਕੀ ਹੈ? (Ghar de bahar ki hai?)', 'ਗੈਰਾਜ (garage)', 'ਬਗੀਚਾ (bagicha)', 'ਪਾਰਕਿੰਗ (parking)', 'ਪੁਲ (pool)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 8: Talking about a pet
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Talking about a pet',
    'Draft — pending native speaker review. Present-tense pet description. Access: free.',
    'short', 2, 8, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਮੇਰੇ ਕੋਲ ਇੱਕ ਕੁੱਤਾ ਹੈ।', 'Mere kol ik kutta hai.', 'I have a dog.'),
    (script_id, paragraph_id, 2, 'ਉਸਦਾ ਨਾਂ ਸ਼ੇਰੂ ਹੈ।', 'Usda naa Sheru hai.', 'His name is Sheru.'),
    (script_id, paragraph_id, 3, 'ਉਹ ਬਹੁਤ ਖੇਡਣਾ ਪਸੰਦ ਕਰਦਾ ਹੈ।', 'Oh bahut khedna pasand karda hai.', 'He likes to play a lot.'),
    (script_id, paragraph_id, 4, 'ਮੈਂ ਹਰ ਰੋਜ਼ ਉਸਨੂੰ ਸੈਰ ''ਤੇ ਲੈ ਜਾਂਦਾ ਹਾਂ।', 'Mai har roz usnu sair te lai jaanda haa.', 'I take him for a walk every day.'),
    (script_id, paragraph_id, 5, 'ਸ਼ੇਰੂ ਮੇਰੇ ਪਰਿਵਾਰ ਦਾ ਹਿੱਸਾ ਹੈ।', 'Sheru mere parivar da hissa hai.', 'Sheru is part of my family.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਕੁੱਤੇ ਦਾ ਨਾਂ ਕੀ ਹੈ? (Kutte da naa ki hai?)', 'ਟੌਮੀ (Tommy)', 'ਸ਼ੇਰੂ (Sheru)', 'ਮੋਤੀ (Moti)', 'ਬਿੱਲੂ (Billu)', 'b', 0),
    (script_id, 'ਸ਼ੇਰੂ ਕੀ ਪਸੰਦ ਕਰਦਾ ਹੈ? (Sheru ki pasand karda hai?)', 'ਸੌਣਾ (sauna)', 'ਖੇਡਣਾ (khedna)', 'ਖਾਣਾ (khana)', 'ਸੈਰ (sair)', 'b', 1),
    (script_id, 'ਮੈਂ ਹਰ ਰੋਜ਼ ਕੀ ਕਰਦਾ ਹਾਂ? (Mai har roz ki karda haa?)', 'ਉਸਨੂੰ ਸੈਰ ''ਤੇ ਲੈ ਜਾਂਦਾ ਹਾਂ (usnu sair te lai jaanda haa)', 'ਉਸਨੂੰ ਨਹਾਉਂਦਾ ਹਾਂ (usnu nahaunda haa)', 'ਉਸਨੂੰ ਸਿਖਾਉਂਦਾ ਹਾਂ (usnu sikhaunda haa)', 'ਉਸਨੂੰ ਖਾਣਾ ਖਿਲਾਉਂਦਾ ਹਾਂ (usnu khana khilaaunda haa)', 'a', 2);

  -- -------------------------------------------------------------------------
  -- Script 9: Asking for directions
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Asking for directions',
    'Draft — pending native speaker review. Past-tense asking for directions. Access: free.',
    'short', 3, 9, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਮੈਂ ਸਟੇਸ਼ਨ ਦਾ ਰਸਤਾ ਪੁੱਛਿਆ ਸੀ।', 'Mai station da rasta puchiya si.', 'I had asked the way to the station.'),
    (script_id, paragraph_id, 2, 'ਇੱਕ ਆਦਮੀ ਨੇ ਮੈਨੂੰ ਸਿੱਧਾ ਜਾਣ ਲਈ ਕਿਹਾ ਸੀ।', 'Ik aadmi ne mainu sidha jaan lai kiha si.', 'A man had told me to go straight.'),
    (script_id, paragraph_id, 3, 'ਫਿਰ ਖੱਬੇ ਪਾਸੇ ਮੁੜਨਾ ਸੀ।', 'Phir khabbe paase murna si.', 'Then I had to turn left.'),
    (script_id, paragraph_id, 4, 'ਸਟੇਸ਼ਨ ਬੈਂਕ ਦੇ ਸਾਹਮਣੇ ਸੀ।', 'Station bank de saahmne si.', 'The station was in front of the bank.'),
    (script_id, paragraph_id, 5, 'ਮੈਂ ਸਮੇਂ ਸਿਰ ਪਹੁੰਚ ਗਿਆ ਸੀ।', 'Mai samen sir pahunch gya si.', 'I had arrived on time.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਕੀ ਪੁੱਛਿਆ? (Mai ki puchiya?)', 'ਸਮਾਂ (samaa)', 'ਰਸਤਾ (rasta)', 'ਕੀਮਤ (keemat)', 'ਪਤਾ (pata)', 'b', 0),
    (script_id, 'ਸਟੇਸ਼ਨ ਕਿੱਥੇ ਸੀ? (Station kitthe si?)', 'ਬੈਂਕ ਦੇ ਸਾਹਮਣੇ (bank de saahmne)', 'ਸਕੂਲ ਦੇ ਕੋਲ (school de kol)', 'ਬਜ਼ਾਰ ਵਿੱਚ (bazaar vich)', 'ਹਸਪਤਾਲ ਦੇ ਪਿੱਛੇ (hspatal de pichhe)', 'a', 1),
    (script_id, 'ਮੈਂ ਕਿਵੇਂ ਪਹੁੰਚਿਆ? (Mai kiven pahunchiya?)', 'ਦੇਰ ਨਾਲ (der naal)', 'ਸਮੇਂ ਸਿਰ (samen sir)', 'ਬਹੁਤ ਜਲਦੀ (bahut jaldi)', 'ਹੌਲੀ ਹੌਲੀ (hauli hauli)', 'b', 2);

END $$;

NOTIFY pgrst, 'reload schema';
