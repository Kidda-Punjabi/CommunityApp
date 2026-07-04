-- =============================================================================
-- Kidda — Comprehension Practice seed (Short tier, batch 4 — final 6)
-- Run in Supabase SQL Editor AFTER:
--   comprehension-practice.sql
--   comprehension-paragraphs-tier.sql
--
-- Idempotent: deletes scripts by title, then re-inserts (scripts 10–15).
-- NOT the same as scripts/seed-comprehension-batch-*.ts — those are Node seeds.
-- =============================================================================

DELETE FROM public.comprehension_scripts
WHERE title IN (
  'Your weekly schedule',
  'A phone call to say hello',
  'Shopping for clothes',
  'A trip to the gurdwara',
  'Playing a sport with friends',
  'A simple recipe you know'
);

DO $$
DECLARE
  script_id UUID;
  paragraph_id UUID;
BEGIN
  -- -------------------------------------------------------------------------
  -- Script 10: Your weekly schedule
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Your weekly schedule',
    'Draft — pending native speaker review. Present habitual weekly schedule. Access: free.',
    'short', 3, 10, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਸੋਮਵਾਰ ਨੂੰ ਮੈਂ ਕੰਮ ''ਤੇ ਜਾਂਦਾ ਹਾਂ।', 'Somvaar nu mai kaam te jaanda haa.', 'On Monday I go to work.'),
    (script_id, paragraph_id, 2, 'ਬੁੱਧਵਾਰ ਨੂੰ ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖਦਾ ਹਾਂ।', 'Budhvaar nu mai Punjabi sikhda haa.', 'On Wednesday I learn Punjabi.'),
    (script_id, paragraph_id, 3, 'ਸ਼ੁੱਕਰਵਾਰ ਨੂੰ ਮੈਂ ਦੋਸਤਾਂ ਨਾਲ ਮਿਲਦਾ ਹਾਂ।', 'Shukarvaar nu mai dostaa naal milda haa.', 'On Friday I meet with friends.'),
    (script_id, paragraph_id, 4, 'ਸ਼ਨੀਵਾਰ ਨੂੰ ਮੈਂ ਆਰਾਮ ਕਰਦਾ ਹਾਂ।', 'Shanivaar nu mai aaraam karda haa.', 'On Saturday I rest.'),
    (script_id, paragraph_id, 5, 'ਐਤਵਾਰ ਨੂੰ ਅਸੀਂ ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦੇ ਹਾਂ।', 'Aitvaar nu asi parivar naal samaa bitaunde haa.', 'On Sunday we spend time with family.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਬੁੱਧਵਾਰ ਨੂੰ ਕੀ ਕਰਦਾ ਹਾਂ? (Mai budhvaar nu ki karda haa?)', 'ਕੰਮ (kaam)', 'ਪੰਜਾਬੀ ਸਿੱਖਦਾ ਹਾਂ (Punjabi sikhda haa)', 'ਆਰਾਮ (aaraam)', 'ਦੋਸਤਾਂ ਨਾਲ ਮਿਲਦਾ ਹਾਂ (dostaa naal milda haa)', 'b', 0),
    (script_id, 'ਮੈਂ ਦੋਸਤਾਂ ਨਾਲ ਕਦੋਂ ਮਿਲਦਾ ਹਾਂ? (Mai dostaa naal kadon milda haa?)', 'ਸੋਮਵਾਰ (Somvaar)', 'ਸ਼ੁੱਕਰਵਾਰ (Shukarvaar)', 'ਐਤਵਾਰ (Aitvaar)', 'ਬੁੱਧਵਾਰ (Budhvaar)', 'b', 1),
    (script_id, 'ਐਤਵਾਰ ਨੂੰ ਅਸੀਂ ਕੀ ਕਰਦੇ ਹਾਂ? (Aitvaar nu asi ki karde haa?)', 'ਕੰਮ ਕਰਦੇ ਹਾਂ (kaam karde haa)', 'ਪਰਿਵਾਰ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦੇ ਹਾਂ (parivar naal samaa bitaunde haa)', 'ਸੌਂਦੇ ਹਾਂ (saunde haa)', 'ਖੇਡਦੇ ਹਾਂ (khedde haa)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 11: A phone call to say hello
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A phone call to say hello',
    'Draft — pending native speaker review. Past-tense phone call to grandmother. Access: free.',
    'short', 3, 11, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਕੱਲ੍ਹ ਮੈਂ ਆਪਣੀ ਨਾਨੀ ਨੂੰ ਫ਼ੋਨ ਕੀਤਾ ਸੀ।', 'Kallh mai apni naani nu phone kita si.', 'Yesterday I had called my grandmother.'),
    (script_id, paragraph_id, 2, 'ਉਹ ਬਹੁਤ ਖੁਸ਼ ਹੋਈ ਸੀ।', 'Oh bahut khush hoi si.', 'She had become very happy.'),
    (script_id, paragraph_id, 3, 'ਅਸੀਂ ਅੱਧਾ ਘੰਟਾ ਗੱਲ ਕੀਤੀ ਸੀ।', 'Asi adhaa ghanta gall kiti si.', 'We had talked for half an hour.'),
    (script_id, paragraph_id, 4, 'ਉਸਨੇ ਮੈਨੂੰ ਆਪਣੀ ਸਿਹਤ ਬਾਰੇ ਦੱਸਿਆ ਸੀ।', 'Usne mainu apni sehat baare dassiya si.', 'She had told me about her health.'),
    (script_id, paragraph_id, 5, 'ਮੈਂ ਜਲਦੀ ਮਿਲਣ ਦਾ ਵਾਅਦਾ ਕੀਤਾ ਸੀ।', 'Mai jaldi milan da vaada kita si.', 'I had promised to meet soon.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਕਿਸਨੂੰ ਫ਼ੋਨ ਕੀਤਾ? (Mai kisnu phone kita?)', 'ਨਾਨੀ (Naani)', 'ਦਾਦੀ (Daadi)', 'ਮਾਸੀ (Maasi)', 'ਭੂਆ (Bhua)', 'a', 0),
    (script_id, 'ਅਸੀਂ ਕਿੰਨੀ ਦੇਰ ਗੱਲ ਕੀਤੀ? (Asi kinni der gall kiti?)', 'ਪੰਦਰਾਂ ਮਿੰਟ (pandraa minute)', 'ਅੱਧਾ ਘੰਟਾ (adhaa ghanta)', 'ਇੱਕ ਘੰਟਾ (ik ghanta)', 'ਦੋ ਘੰਟੇ (do ghante)', 'b', 1),
    (script_id, 'ਮੈਂ ਕੀ ਵਾਅਦਾ ਕੀਤਾ? (Mai ki vaada kita?)', 'ਪੈਸੇ ਭੇਜਣ ਦਾ (paise bhejan da)', 'ਜਲਦੀ ਮਿਲਣ ਦਾ (jaldi milan da)', 'ਚਿੱਠੀ ਲਿਖਣ ਦਾ (chitthi likhan da)', 'ਫ਼ੋਨ ਕਰਨ ਦਾ (phone karan da)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 12: Shopping for clothes
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Shopping for clothes',
    'Draft — pending native speaker review. Past-tense clothes shopping. Access: free.',
    'short', 3, 12, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਅਸੀਂ ਕੱਪੜਿਆਂ ਦੀ ਦੁਕਾਨ ''ਤੇ ਗਏ ਸੀ।', 'Asi kapriaa di dukaan te gae si.', 'We had gone to a clothes shop.'),
    (script_id, paragraph_id, 2, 'ਮੈਂ ਇੱਕ ਨਵੀਂ ਕਮੀਜ਼ ਖਰੀਦੀ ਸੀ।', 'Mai ik navee kameez kharidi si.', 'I had bought a new shirt.'),
    (script_id, paragraph_id, 3, 'ਮੇਰੀ ਭੈਣ ਨੇ ਇੱਕ ਸੂਟ ਪਸੰਦ ਕੀਤਾ ਸੀ।', 'Meri bhain ne ik suit pasand kita si.', 'My sister had liked a suit.'),
    (script_id, paragraph_id, 4, 'ਦੁਕਾਨਦਾਰ ਨੇ ਸਾਨੂੰ ਛੋਟ ਦਿੱਤੀ ਸੀ।', 'Dukaandaar ne saanu chhot ditti si.', 'The shopkeeper had given us a discount.'),
    (script_id, paragraph_id, 5, 'ਅਸੀਂ ਬਹੁਤ ਖੁਸ਼ ਹੋ ਕੇ ਘਰ ਆਏ ਸੀ।', 'Asi bahut khush ho ke ghar aae si.', 'We had come home very happy.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਕੀ ਖਰੀਦਿਆ? (Mai ki kharidiya?)', 'ਕਮੀਜ਼ (kameez)', 'ਸੂਟ (suit)', 'ਜੁੱਤੇ (jutte)', 'ਦੁਪੱਟਾ (dupatta)', 'a', 0),
    (script_id, 'ਭੈਣ ਨੇ ਕੀ ਪਸੰਦ ਕੀਤਾ? (Bhain ne ki pasand kita?)', 'ਕਮੀਜ਼ (kameez)', 'ਸੂਟ (suit)', 'ਦੁਪੱਟਾ (dupatta)', 'ਜੁੱਤੇ (jutte)', 'b', 1),
    (script_id, 'ਦੁਕਾਨਦਾਰ ਨੇ ਕੀ ਦਿੱਤਾ? (Dukaandaar ne ki ditta?)', 'ਤੋਹਫ਼ਾ (tohfa)', 'ਛੋਟ (chhot)', 'ਬਿੱਲ (bill)', 'ਰਸੀਦ (raseed)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 13: A trip to the gurdwara
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A trip to the gurdwara',
    'Draft — pending native speaker review. Past-tense Sunday gurdwara visit. Access: free.',
    'short', 3, 13, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਐਤਵਾਰ ਨੂੰ ਅਸੀਂ ਗੁਰਦੁਆਰੇ ਗਏ ਸੀ।', 'Aitvaar nu asi gurduare gae si.', 'On Sunday we had gone to the gurdwara.'),
    (script_id, paragraph_id, 2, 'ਅਸੀਂ ਅਰਦਾਸ ਵਿੱਚ ਬੈਠੇ ਸੀ।', 'Asi ardaas vich baithe si.', 'We had sat for the ardaas (prayer).'),
    (script_id, paragraph_id, 3, 'ਬਾਅਦ ਵਿੱਚ ਅਸੀਂ ਲੰਗਰ ਛਕਿਆ ਸੀ।', 'Baad vich asi langar chakiya si.', 'Afterwards we had eaten langar.'),
    (script_id, paragraph_id, 4, 'ਲੰਗਰ ਬਹੁਤ ਸੁਆਦੀ ਸੀ।', 'Langar bahut suadi si.', 'The langar was very tasty.'),
    (script_id, paragraph_id, 5, 'ਅਸੀਂ ਮਨ ਵਿੱਚ ਸ਼ਾਂਤੀ ਮਹਿਸੂਸ ਕੀਤੀ ਸੀ।', 'Asi man vich shaanti mehsoos kiti si.', 'We had felt peace in our hearts.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਅਸੀਂ ਕਦੋਂ ਗੁਰਦੁਆਰੇ ਗਏ? (Asi kadon gurduare gae?)', 'ਸ਼ਨੀਵਾਰ (Shanivaar)', 'ਐਤਵਾਰ (Aitvaar)', 'ਸੋਮਵਾਰ (Somvaar)', 'ਸ਼ੁੱਕਰਵਾਰ (Shukarvaar)', 'b', 0),
    (script_id, 'ਬਾਅਦ ਵਿੱਚ ਅਸੀਂ ਕੀ ਕੀਤਾ? (Baad vich asi ki kita?)', 'ਲੰਗਰ ਛਕਿਆ (langar chakiya)', 'ਘਰ ਗਏ (ghar gae)', 'ਸ਼ਾਪਿੰਗ ਕੀਤੀ (shopping kiti)', 'ਅਰਦਾਸ ਕੀਤੀ (ardaas kiti)', 'a', 1),
    (script_id, 'ਲੰਗਰ ਕਿਹੋ ਜਿਹਾ ਸੀ? (Langar kiho jiha si?)', 'ਸੁਆਦੀ (suadi)', 'ਠੰਡਾ (thanda)', 'ਖਰਾਬ (kharab)', 'ਗਰਮ (garam)', 'a', 2);

  -- -------------------------------------------------------------------------
  -- Script 14: Playing a sport with friends
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Playing a sport with friends',
    'Draft — pending native speaker review. Past-tense cricket in the park. Access: free.',
    'short', 3, 14, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਸ਼ਾਮ ਨੂੰ ਅਸੀਂ ਪਾਰਕ ਵਿੱਚ ਕ੍ਰਿਕਟ ਖੇਡਿਆ ਸੀ।', 'Shaam nu asi park vich cricket khediya si.', 'In the evening we had played cricket in the park.'),
    (script_id, paragraph_id, 2, 'ਮੇਰੇ ਦੋਸਤ ਨੇ ਬਹੁਤ ਵਧੀਆ ਬੱਲੇਬਾਜ਼ੀ ਕੀਤੀ ਸੀ।', 'Mere dost ne bahut vadhia ballebaazi kiti si.', 'My friend had batted very well.'),
    (script_id, paragraph_id, 3, 'ਸਾਡੀ ਟੀਮ ਜਿੱਤ ਗਈ ਸੀ।', 'Saadi team jitt gai si.', 'Our team had won.'),
    (script_id, paragraph_id, 4, 'ਖੇਡ ਤੋਂ ਬਾਅਦ ਅਸੀਂ ਜੂਸ ਪੀਤਾ ਸੀ।', 'Khed toh baad asi juice peeta si.', 'After the game we had drunk juice.'),
    (script_id, paragraph_id, 5, 'ਸਾਰਿਆਂ ਨੇ ਬਹੁਤ ਮਜ਼ਾ ਕੀਤਾ ਸੀ।', 'Saariaa ne bahut maza kita si.', 'Everyone had had a lot of fun.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਅਸੀਂ ਕਿਹੜੀ ਖੇਡ ਖੇਡੀ? (Asi kihri khed khedi?)', 'ਫੁੱਟਬਾਲ (football)', 'ਕ੍ਰਿਕਟ (cricket)', 'ਹਾਕੀ (hockey)', 'ਵਾਲੀਬਾਲ (volleyball)', 'b', 0),
    (script_id, 'ਕੌਣ ਜਿੱਤਿਆ? (Kaun jittiya?)', 'ਦੂਸਰੀ ਟੀਮ (doosri team)', 'ਸਾਡੀ ਟੀਮ (saadi team)', 'ਕੋਈ ਨਹੀਂ (koi nahi)', 'ਦੋਵਾਂ ਟੀਮਾਂ (dovaan teamaa)', 'b', 1),
    (script_id, 'ਖੇਡ ਤੋਂ ਬਾਅਦ ਅਸੀਂ ਕੀ ਪੀਤਾ? (Khed toh baad asi ki peeta?)', 'ਚਾਹ (chah)', 'ਜੂਸ (juice)', 'ਪਾਣੀ (pani)', 'ਲੱਸੀ (lassi)', 'b', 2);

  -- -------------------------------------------------------------------------
  -- Script 15: A simple recipe you know
  -- -------------------------------------------------------------------------
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A simple recipe you know',
    'Draft — pending native speaker review. Present habitual tea-making instructions. Access: free.',
    'short', 2, 15, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order)
  VALUES (script_id, 1) RETURNING id INTO paragraph_id;

  INSERT INTO public.comprehension_sentences (
    script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation
  ) VALUES
    (script_id, paragraph_id, 1, 'ਮੈਨੂੰ ਚਾਹ ਬਣਾਉਣੀ ਆਉਂਦੀ ਹੈ।', 'Mainu chah banaunee aaundi hai.', 'I know how to make tea.'),
    (script_id, paragraph_id, 2, 'ਪਹਿਲਾਂ ਮੈਂ ਪਾਣੀ ਉਬਾਲਦਾ ਹਾਂ।', 'Pehlaa mai pani ubaalda haa.', 'First I boil water.'),
    (script_id, paragraph_id, 3, 'ਫਿਰ ਮੈਂ ਚਾਹ ਪੱਤੀ ਅਤੇ ਦੁੱਧ ਪਾਉਂਦਾ ਹਾਂ।', 'Phir mai chah patti ate dudh paunda haa.', 'Then I add tea leaves and milk.'),
    (script_id, paragraph_id, 4, 'ਅਖੀਰ ਵਿੱਚ ਮੈਂ ਖੰਡ ਪਾਉਂਦਾ ਹਾਂ।', 'Akheer vich mai khand paunda haa.', 'At the end I add sugar.'),
    (script_id, paragraph_id, 5, 'ਗਰਮ ਚਾਹ ਪੀਣ ਦਾ ਮਜ਼ਾ ਹੀ ਵੱਖਰਾ ਹੈ।', 'Garam chah peen da maza hi vakhra hai.', 'Drinking hot tea is a joy like no other.');

  INSERT INTO public.comprehension_questions (
    script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order
  ) VALUES
    (script_id, 'ਮੈਂ ਪਹਿਲਾਂ ਕੀ ਕਰਦਾ ਹਾਂ? (Mai pehlaa ki karda haa?)', 'ਚਾਹ ਪੱਤੀ ਪਾਉਂਦਾ ਹਾਂ (chah patti paunda haa)', 'ਪਾਣੀ ਉਬਾਲਦਾ ਹਾਂ (pani ubaalda haa)', 'ਖੰਡ ਪਾਉਂਦਾ ਹਾਂ (khand paunda haa)', 'ਦੁੱਧ ਪਾਉਂਦਾ ਹਾਂ (dudh paunda haa)', 'b', 0),
    (script_id, 'ਅਖੀਰ ਵਿੱਚ ਮੈਂ ਕੀ ਪਾਉਂਦਾ ਹਾਂ? (Akheer vich mai ki paunda haa?)', 'ਦੁੱਧ (dudh)', 'ਖੰਡ (khand)', 'ਪਾਣੀ (pani)', 'ਚਾਹ ਪੱਤੀ (chah patti)', 'b', 1),
    (script_id, 'ਮੈਂ ਕੀ ਬਣਾਉਣਾ ਜਾਣਦਾ ਹਾਂ? (Mai ki banaunaa jaanda haa?)', 'ਕੌਫੀ (coffee)', 'ਚਾਹ (chah)', 'ਦੁੱਧ (dudh)', 'ਜੂਸ (juice)', 'b', 2);

END $$;

NOTIFY pgrst, 'reload schema';
