-- =============================================================================
-- Kidda — Comprehension Practice seed (Short tier, batches 1–2)
-- Run in Supabase SQL Editor AFTER:
--   comprehension-practice.sql
--   comprehension-paragraphs-tier.sql
--
-- Idempotent: deletes scripts by title, then re-inserts (scripts 1–6).
-- NOT the same as scripts/seed-comprehension-batch-*.ts — those are Node seeds.
-- =============================================================================

DELETE FROM public.comprehension_scripts
WHERE title IN (
  'Meeting a friend for tea',
  'Introducing your family',
  'Ordering food at a dhaba',
  'A trip to the market',
  'Today''s weather',
  'A normal day''s routine'
);

DO $$
DECLARE
  script_id UUID;
  paragraph_id UUID;
BEGIN
  -- -------------------------------------------------------------------------
  -- Script 1: Meeting a friend for tea
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Meeting a friend for tea',
    'Draft — pending native speaker review. A past-tense café visit with a friend. Access: free.',
    'short', 2, 1, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਅੱਜ ਮੈਂ ਆਪਣੇ ਦੋਸਤ ਨੂੰ ਮਿਲਿਆ ਸੀ।', 'Ajj mai apne dost nu miliya si.', 'Today I had met my friend.'),
    (script_id, paragraph_id, 2, 'ਅਸੀਂ ਇੱਕ ਕੈਫੇ ਵਿੱਚ ਬੈਠੇ ਸੀ।', 'Asi ik cafe vich baithe si.', 'We had sat in a café.'),
    (script_id, paragraph_id, 3, 'ਉਸ ਨੇ ਚਾਹ ਮੰਗਵਾਈ ਸੀ ਅਤੇ ਮੈਂ ਕੌਫੀ।', 'Us ne chah mangvai si ate mai coffee.', 'They had ordered tea and I had coffee.'),
    (script_id, paragraph_id, 4, 'ਅਸੀਂ ਬਹੁਤ ਗੱਲਾਂ ਕੀਤੀਆਂ ਸੀ।', 'Asi bahut gallaa kitiaa si.', 'We had talked a lot.'),
    (script_id, paragraph_id, 5, 'ਸਮਾਂ ਬਹੁਤ ਜਲਦੀ ਲੰਘ ਗਿਆ ਸੀ।', 'Samaa bahut jaldi langh gya si.', 'The time had passed very quickly.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਦੋਸਤ ਨੇ ਕੀ ਮੰਗਵਾਇਆ? (Dost ne ki mangvaya?)', 'ਚਾਹ (chah)', 'ਕੌਫੀ (coffee)', 'ਪਾਣੀ (pani)', 'ਜੂਸ (juice)', 'a', 0),
    (script_id, 'ਉਹ ਕਿੱਥੇ ਬੈਠੇ? (Oh kitthe baithe?)', 'ਘਰ (ghar)', 'ਕੈਫੇ (cafe)', 'ਪਾਰਕ (park)', 'ਬਾਜ਼ਾਰ (bazaar)', 'b', 1),
    (script_id, 'ਸਮਾਂ ਕਿਵੇਂ ਲੰਘਿਆ? (Samaa kiven langhiya?)', 'ਹੌਲੀ (hauli)', 'ਜਲਦੀ (jaldi)', 'ਬੋਰਿੰਗ (boring)', 'ਬਹੁਤ ਲੰਬਾ (bahut lamba)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 2: Introducing your family
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Introducing your family',
    'Draft — pending native speaker review. Present-tense family introduction. Access: free.',
    'short', 2, 2, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਮੇਰਾ ਪਰਿਵਾਰ ਵੱਡਾ ਹੈ।', 'Mera parivar vadda hai.', 'My family is big.'),
    (script_id, paragraph_id, 2, 'ਮੇਰੇ ਮਾਤਾ-ਪਿਤਾ, ਇੱਕ ਭਰਾ ਅਤੇ ਇੱਕ ਭੈਣ ਹੈ।', 'Mere mata-pita, ik bhara ate ik bhain hai.', 'I have my parents, one brother, and one sister.'),
    (script_id, paragraph_id, 3, 'ਮੇਰੇ ਪਿਤਾ ਜੀ ਡਾਕਟਰ ਹਨ।', 'Mere pita ji doctor han.', 'My father is a doctor.'),
    (script_id, paragraph_id, 4, 'ਮੇਰੀ ਮਾਤਾ ਜੀ ਸਕੂਲ ਵਿੱਚ ਸਿਖਾਉਂਦੇ ਹਨ।', 'Meri mata ji school vich sikhaunde han.', 'My mother teaches at a school.'),
    (script_id, paragraph_id, 5, 'ਅਸੀਂ ਹਰ ਐਤਵਾਰ ਇਕੱਠੇ ਖਾਣਾ ਖਾਂਦੇ ਹਾਂ।', 'Asi har aitvar ikatthe khana khaande haa.', 'We eat together every Sunday.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਪਿਤਾ ਜੀ ਕੀ ਕੰਮ ਕਰਦੇ ਹਨ? (Pita ji ki kaam karde han?)', 'ਡਾਕਟਰ (doctor)', 'ਅਧਿਆਪਕ (adhiapak)', 'ਇੰਜੀਨੀਅਰ (engineer)', 'ਵਕੀਲ (vakil)', 'a', 0),
    (script_id, 'ਮਾਤਾ ਜੀ ਕੀ ਕਰਦੇ ਹਨ? (Mata ji ki karde han?)', 'ਸਕੂਲ ਵਿੱਚ ਸਿਖਾਉਂਦੇ ਹਨ (school vich sikhaunde han)', 'ਹਸਪਤਾਲ ਵਿੱਚ ਕੰਮ ਕਰਦੇ ਹਨ (hspatal vich kaam karde han)', 'ਦੁਕਾਨ ਚਲਾਉਂਦੇ ਹਨ (dukan chalaunde han)', 'ਘਰ ਵਿੱਚ ਰਹਿੰਦੇ ਹਨ (ghar vich rahinde han)', 'a', 1),
    (script_id, 'ਪਰਿਵਾਰ ਕਦੋਂ ਇਕੱਠੇ ਖਾਣਾ ਖਾਂਦਾ ਹੈ? (Parivar kadon ikatthe khana khaanda hai?)', 'ਸ਼ਨੀਵਾਰ (shanivar)', 'ਐਤਵਾਰ (aitvar)', 'ਸੋਮਵਾਰ (somvar)', 'ਮੰਗਲਵਾਰ (mangalvar)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 3: Ordering food at a dhaba
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Ordering food at a dhaba',
    'Draft — pending native speaker review. Past-tense visit to a roadside dhaba. Access: free.',
    'short', 3, 3, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਅਸੀਂ ਇੱਕ ਢਾਬੇ ''ਤੇ ਗਏ ਸੀ।', 'Asi ik dhabe te gae si.', 'We had gone to a dhaba (roadside eatery).'),
    (script_id, paragraph_id, 2, 'ਵੇਟਰ ਨੇ ਮੀਨੂ ਦਿੱਤਾ ਸੀ।', 'Waiter ne menu ditta si.', 'The waiter had given the menu.'),
    (script_id, paragraph_id, 3, 'ਮੈਂ ਦਾਲ ਅਤੇ ਰੋਟੀ ਮੰਗਵਾਈ ਸੀ।', 'Mai daal ate roti mangvai si.', 'I had ordered lentils and bread.'),
    (script_id, paragraph_id, 4, 'ਮੇਰੇ ਦੋਸਤ ਨੇ ਪਨੀਰ ਦੀ ਸਬਜ਼ੀ ਲਈ ਸੀ।', 'Mere dost ne paneer di sabzi lai si.', 'My friend had had paneer curry.'),
    (script_id, paragraph_id, 5, 'ਖਾਣਾ ਬਹੁਤ ਸੁਆਦੀ ਸੀ।', 'Khana bahut suadi si.', 'The food was very tasty.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਕੀ ਮੰਗਵਾਇਆ? (Mai ki mangvaya?)', 'ਦਾਲ ਅਤੇ ਰੋਟੀ (daal ate roti)', 'ਪਨੀਰ (paneer)', 'ਚੌਲ (chaul)', 'ਸਬਜ਼ੀ (sabzi)', 'a', 0),
    (script_id, 'ਦੋਸਤ ਨੇ ਕੀ ਲਿਆ? (Dost ne ki liya?)', 'ਦਾਲ (daal)', 'ਪਨੀਰ ਦੀ ਸਬਜ਼ੀ (paneer di sabzi)', 'ਰੋਟੀ (roti)', 'ਪਰਾਠਾ (paratha)', 'b', 1),
    (script_id, 'ਖਾਣਾ ਕਿਵੇਂ ਸੀ? (Khana kiven si?)', 'ਸੁਆਦੀ (suadi)', 'ਖਰਾਬ (kharab)', 'ਠੰਡਾ (thanda)', 'ਗਰਮ (garam)', 'a', 2);

  -- -------------------------------------------------------------------------
  -- Script 4: A trip to the market
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A trip to the market',
    'Draft — pending native speaker review. Past-tense market visit. Access: free.',
    'short', 2, 4, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਅਸੀਂ ਬਜ਼ਾਰ ਗਏ ਸੀ।', 'Asi bazaar gae si.', 'We had gone to the market.'),
    (script_id, paragraph_id, 2, 'ਮੈਂ ਸਬਜ਼ੀਆਂ ਖਰੀਦੀਆਂ ਸੀ।', 'Mai sabziaa kharidiaa si.', 'I had bought vegetables.'),
    (script_id, paragraph_id, 3, 'ਮੇਰੀ ਭੈਣ ਨੇ ਫਲ ਲਏ ਸੀ।', 'Meri bhain ne phal lae si.', 'My sister had bought fruit.'),
    (script_id, paragraph_id, 4, 'ਬਜ਼ਾਰ ਵਿੱਚ ਬਹੁਤ ਭੀੜ ਸੀ।', 'Bazaar vich bahut bheed si.', 'There was a big crowd in the market.'),
    (script_id, paragraph_id, 5, 'ਅਸੀਂ ਦੋ ਘੰਟੇ ਬਜ਼ਾਰ ਵਿੱਚ ਰਹੇ ਸੀ।', 'Asi do ghante bazaar vich rahe si.', 'We had stayed at the market for two hours.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਕੀ ਖਰੀਦਿਆ? (Mai ki kharidiya?)', 'ਸਬਜ਼ੀਆਂ (sabziaa)', 'ਫਲ (phal)', 'ਕੱਪੜੇ (kapre)', 'ਚਾਵਲ (chaaval)', 'a', 0),
    (script_id, 'ਭੈਣ ਨੇ ਕੀ ਲਿਆ? (Bhain ne ki liya?)', 'ਸਬਜ਼ੀਆਂ (sabziaa)', 'ਫਲ (phal)', 'ਦੁੱਧ (dudh)', 'ਰੋਟੀ (roti)', 'b', 1),
    (script_id, 'ਅਸੀਂ ਬਜ਼ਾਰ ਵਿੱਚ ਕਿੰਨਾ ਸਮਾਂ ਰਹੇ? (Asi bazaar vich kinna samaa rahe?)', 'ਇੱਕ ਘੰਟਾ (ik ghanta)', 'ਦੋ ਘੰਟੇ (do ghante)', 'ਤਿੰਨ ਘੰਟੇ (tinn ghante)', 'ਅੱਧਾ ਘੰਟਾ (adha ghanta)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 5: Today's weather
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Today''s weather',
    'Draft — pending native speaker review. Present weather plus one future line. Access: free.',
    'short', 2, 5, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਅੱਜ ਮੌਸਮ ਬਹੁਤ ਗਰਮ ਹੈ।', 'Ajj mausam bahut garam hai.', 'Today the weather is very hot.'),
    (script_id, paragraph_id, 2, 'ਅਸਮਾਨ ਸਾਫ਼ ਹੈ।', 'Asmaan saaf hai.', 'The sky is clear.'),
    (script_id, paragraph_id, 3, 'ਧੁੱਪ ਬਹੁਤ ਤੇਜ਼ ਹੈ।', 'Dhup bahut tez hai.', 'The sun is very strong.'),
    (script_id, paragraph_id, 4, 'ਮੈਨੂੰ ਠੰਡਾ ਪਾਣੀ ਪੀਣਾ ਪਸੰਦ ਹੈ।', 'Mainu thanda pani peena pasand hai.', 'I like drinking cold water.'),
    (script_id, paragraph_id, 5, 'ਕੱਲ੍ਹ ਬਾਰਿਸ਼ ਹੋਵੇਗੀ।', 'Kallh baarish hovegi.', 'Tomorrow it will rain.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਅੱਜ ਮੌਸਮ ਕਿਹੋ ਜਿਹਾ ਹੈ? (Ajj mausam kiho jiha hai?)', 'ਗਰਮ (garam)', 'ਠੰਡਾ (thanda)', 'ਬਰਸਾਤੀ (barsaati)', 'ਹਵਾਦਾਰ (havaadaar)', 'a', 0),
    (script_id, 'ਅਸਮਾਨ ਕਿਹੋ ਜਿਹਾ ਹੈ? (Asmaan kiho jiha hai?)', 'ਬੱਦਲਵਾਈ (baddalvai)', 'ਸਾਫ਼ (saaf)', 'ਧੁੰਦ (dhund)', 'ਰੰਗੀਨ (rangin)', 'b', 1),
    (script_id, 'ਕੱਲ੍ਹ ਕੀ ਹੋਵੇਗਾ? (Kallh ki hovega?)', 'ਬਾਰਿਸ਼ (baarish)', 'ਬਰਫ਼ (barf)', 'ਹਵਾ (hawa)', 'ਧੁੱਪ (dhup)', 'a', 2);

  -- -------------------------------------------------------------------------
  -- Script 6: A normal day's routine
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A normal day''s routine',
    'Draft — pending native speaker review. Present habitual daily routine. Access: free.',
    'short', 3, 6, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਮੈਂ ਹਰ ਰੋਜ਼ ਸਵੇਰੇ ਛੇ ਵਜੇ ਉੱਠਦਾ ਹਾਂ।', 'Mai har roz savere che vaje utthda haa.', 'I wake up every day at six in the morning.'),
    (script_id, paragraph_id, 2, 'ਫਿਰ ਮੈਂ ਨਹਾਉਂਦਾ ਹਾਂ ਅਤੇ ਨਾਸ਼ਤਾ ਕਰਦਾ ਹਾਂ।', 'Phir mai nahaunda haa ate naashta karda haa.', 'Then I bathe and have breakfast.'),
    (script_id, paragraph_id, 3, 'ਮੈਂ ਕੰਮ ''ਤੇ ਬੱਸ ਰਾਹੀਂ ਜਾਂਦਾ ਹਾਂ।', 'Mai kaam te bus raheen jaanda haa.', 'I go to work by bus.'),
    (script_id, paragraph_id, 4, 'ਸ਼ਾਮ ਨੂੰ ਮੈਂ ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦਾ ਹਾਂ।', 'Shaam nu mai parivar naal samaa bitaunda haa.', 'In the evening I spend time with family.'),
    (script_id, paragraph_id, 5, 'ਰਾਤ ਨੂੰ ਮੈਂ ਦਸ ਵਜੇ ਸੌਂ ਜਾਂਦਾ ਹਾਂ।', 'Raat nu mai das vaje saun jaanda haa.', 'At night I go to sleep at ten.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਸਵੇਰੇ ਕਦੋਂ ਉੱਠਦਾ ਹਾਂ? (Mai savere kadon utthda haa?)', 'ਪੰਜ ਵਜੇ (panj vaje)', 'ਛੇ ਵਜੇ (che vaje)', 'ਸੱਤ ਵਜੇ (satt vaje)', 'ਅੱਠ ਵਜੇ (ath vaje)', 'b', 0),
    (script_id, 'ਮੈਂ ਕੰਮ ''ਤੇ ਕਿਵੇਂ ਜਾਂਦਾ ਹਾਂ? (Mai kaam te kiven jaanda haa?)', 'ਕਾਰ (car)', 'ਬੱਸ (bus)', 'ਪੈਦਲ (paidal)', 'ਟ੍ਰੇਨ (train)', 'b', 1),
    (script_id, 'ਮੈਂ ਰਾਤ ਨੂੰ ਕਦੋਂ ਸੌਂਦਾ ਹਾਂ? (Mai raat nu kadon saunda haa?)', 'ਨੌਂ ਵਜੇ (naun vaje)', 'ਦਸ ਵਜੇ (das vaje)', 'ਗਿਆਰਾਂ ਵਜੇ (giaraan vaje)', 'ਬਾਰਹ ਵਜੇ (barah vaje)', 'b', 2);

END $$;

NOTIFY pgrst, 'reload schema';
