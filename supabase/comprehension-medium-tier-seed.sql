-- =============================================================================
-- Kidda — Comprehension Practice seed (Medium tier, all 11 scripts)
-- Run in Supabase SQL Editor AFTER:
--   comprehension-practice.sql
--   comprehension-paragraphs-tier.sql
--
-- Idempotent: deletes scripts by title, then re-inserts (M1–M11, display_order 16–26).
-- NOT the same as scripts/seed-comprehension-medium.ts — that is a Node seed.
-- =============================================================================

DELETE FROM public.comprehension_scripts
WHERE title IN (
  'A wedding story',
  'Planning a trip abroad',
  'A childhood memory',
  'A visit to the doctor',
  'Celebrating Vaisakhi with family',
  'Catching up with a grandparent on the phone',
  'Cooking a family recipe together',
  'A day that didn''t go to plan',
  'Starting a new job or course',
  'A misunderstanding between friends',
  'Moving to a new house'
);

DO $$
DECLARE
  script_id UUID;
  para1_id UUID;
  para2_id UUID;
BEGIN
  -- ===========================================================================
  -- M1: A wedding story
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A wedding story',
    'Draft — pending native speaker review. Past-tense sister''s wedding. Access: paid.',
    'medium', 4, 16, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਪਿਛਲੇ ਮਹੀਨੇ ਮੇਰੀ ਭੈਣ ਦਾ ਵਿਆਹ ਹੋਇਆ ਸੀ।', 'Pichhle mahine meri bhain da viah hoiya si.', 'Last month my sister''s wedding happened.'),
    (script_id, para1_id, 2, 'ਸਾਰਾ ਪਰਿਵਾਰ ਇਕੱਠਾ ਹੋਇਆ ਸੀ।', 'Saara parivar ikattha hoiya si.', 'The whole family had gathered.'),
    (script_id, para1_id, 3, 'ਘਰ ਨੂੰ ਫੁੱਲਾਂ ਨਾਲ ਸਜਾਇਆ ਗਿਆ ਸੀ।', 'Ghar nu phullaa naal sajaiya gya si.', 'The house had been decorated with flowers.'),
    (script_id, para1_id, 4, 'ਸਾਰੇ ਰਿਸ਼ਤੇਦਾਰ ਦੂਰੋਂ ਆਏ ਸੀ।', 'Saare rishtedaar dooroh aae si.', 'All the relatives had come from far away.'),
    (script_id, para1_id, 5, 'ਹਰ ਕੋਈ ਬਹੁਤ ਖੁਸ਼ ਸੀ।', 'Har koi bahut khush si.', 'Everyone was very happy.'),
    (script_id, para2_id, 1, 'ਸਵੇਰੇ ਅਨੰਦ ਕਾਰਜ ਗੁਰਦੁਆਰੇ ਵਿੱਚ ਹੋਇਆ ਸੀ।', 'Savere anand kaaraj gurduare vich hoiya si.', 'In the morning the anand karaj happened at the gurdwara.'),
    (script_id, para2_id, 2, 'ਮੇਰੀ ਭੈਣ ਲਾਲ ਜੋੜੇ ਵਿੱਚ ਬਹੁਤ ਸੋਹਣੀ ਲੱਗ ਰਹੀ ਸੀ।', 'Meri bhain laal jode vich bahut sohni lagg rahi si.', 'My sister was looking very beautiful in a red outfit.'),
    (script_id, para2_id, 3, 'ਸ਼ਾਮ ਨੂੰ ਰਿਸੈਪਸ਼ਨ ਵਿੱਚ ਸਾਰਿਆਂ ਨੇ ਨੱਚਿਆ ਸੀ।', 'Shaam nu reception vich saariaa ne nachiya si.', 'In the evening at the reception everyone had danced.'),
    (script_id, para2_id, 4, 'ਖਾਣਾ ਬਹੁਤ ਸੁਆਦੀ ਸੀ।', 'Khana bahut suadi si.', 'The food was very tasty.'),
    (script_id, para2_id, 5, 'ਇਹ ਦਿਨ ਮੇਰੀ ਜ਼ਿੰਦਗੀ ਦੇ ਸਭ ਤੋਂ ਖ਼ੁਸ਼ੀ ਭਰੇ ਦਿਨਾਂ ਵਿੱਚੋਂ ਇੱਕ ਸੀ।', 'Ih din meri zindagi de sab toh khushi bhare dinaa vichoh ik si.', 'This day was one of the happiest days of my life.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਕਿਸਦਾ ਵਿਆਹ ਹੋਇਆ? (Kisda viah hoiya?)', 'ਮੇਰਾ (mera)', 'ਮੇਰੀ ਭੈਣ ਦਾ (meri bhain da)', 'ਮੇਰੇ ਭਰਾ ਦਾ (mere bhara da)', 'ਮੇਰੇ ਚacha da (mere chacha da)', 'b', 0),
    (script_id, 'ਅਨੰਦ ਕਾਰਜ ਕਿੱਥੇ ਹੋਇਆ? (Anand kaaraj kitthe hoiya?)', 'ਘਰ (ghar)', 'ਗੁਰਦੁਆਰੇ (gurduare)', 'ਹੋਟਲ (hotel)', 'ਪਾਰਕ (park)', 'b', 1),
    (script_id, 'ਭੈਣ ਨੇ ਕਿਹੜੇ ਰੰਗ ਦਾ ਜੋੜਾ ਪਾਇਆ? (Bhain ne kihre rang da joda paaiya?)', 'ਲਾਲ (laal)', 'ਪੀਲਾ (peela)', 'ਚਿੱਟਾ (chitta)', 'ਹਰਾ (hara)', 'a', 2),
    (script_id, 'ਸ਼ਾਮ ਨੂੰ ਕੀ ਹੋਇਆ? (Shaam nu ki hoiya?)', 'ਸਾਰੇ ਸੌਂ ਗਏ (saare saun gae)', 'ਸਾਰਿਆਂ ਨੇ ਨੱਚਿਆ (saariaa ne nachiya)', 'ਸਾਰੇ ਘਰ ਗਏ (saare ghar gae)', 'ਸਾਰੇ ਖਾਣਾ ਖਾਧਾ (saare khana khadha)', 'b', 3);

  -- ===========================================================================
  -- M2: Planning a trip abroad
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Planning a trip abroad',
    'Draft — pending native speaker review. Future-tense trip to Punjab. Access: paid.',
    'medium', 4, 17, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਅਸੀਂ ਅਗਲੇ ਸਾਲ ਪੰਜਾਬ ਜਾਣ ਦੀ ਯੋਜਨਾ ਬਣਾ ਰਹੇ ਹਾਂ।', 'Asi agle saal Punjab jaan di yojna bana rahe haa.', 'We are planning to go to Punjab next year.'),
    (script_id, para1_id, 2, 'ਅਸੀਂ ਗਰਮੀਆਂ ਵਿੱਚ ਜਾਵਾਂਗੇ।', 'Asi garmiaa vich jaavaange.', 'We will go in the summer.'),
    (script_id, para1_id, 3, 'ਸਾਨੂੰ ਪਾਸਪੋਰਟ ਅਤੇ ਵੀਜ਼ਾ ਬਣਵਾਉਣਾ ਪਵੇਗਾ।', 'Saanu passport ate visa banvaunaa pavega.', 'We will have to get passports and visas made.'),
    (script_id, para1_id, 4, 'ਅਸੀਂ ਟਿਕਟਾਂ ਪਹਿਲਾਂ ਹੀ ਬੁੱਕ ਕਰਾਂਗੇ।', 'Asi ticketaa pehlaa hi book karaange.', 'We will book tickets in advance.'),
    (script_id, para1_id, 5, 'ਮੇਰੀ ਮਾਂ ਬਹੁਤ ਖੁਸ਼ ਹੈ ਕਿਉਂਕਿ ਉਹ ਆਪਣੇ ਪਿੰਡ ਜਾ ਰਹੀ ਹੈ।', 'Meri maa bahut khush hai kiunki oh apne pind ja rahi hai.', 'My mother is very happy because she''s going to her village.'),
    (script_id, para2_id, 1, 'ਅਸੀਂ ਅੰਮ੍ਰਿਤਸਰ ਅਤੇ ਦਿੱਲੀ ਦੋਵੇਂ ਦੇਖਾਂਗੇ।', 'Asi Amritsar ate Delhi doven dekhaange.', 'We will see both Amritsar and Delhi.'),
    (script_id, para2_id, 2, 'ਮੈਂ ਹਰਿਮੰਦਰ ਸਾਹਿਬ ਦੇ ਦਰਸ਼ਨ ਕਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ।', 'Mai Harmandar Sahib de darshan karna chahunda haa.', 'I want to have darshan of Harmandar Sahib.'),
    (script_id, para2_id, 3, 'ਅਸੀਂ ਆਪਣੇ ਰਿਸ਼ਤੇਦਾਰਾਂ ਨੂੰ ਵੀ ਮਿਲਾਂਗੇ।', 'Asi apne rishtedaaraa nu vi milaange.', 'We will also meet our relatives.'),
    (script_id, para2_id, 4, 'ਸਫ਼ਰ ਤਿੰਨ ਹਫ਼ਤਿਆਂ ਦਾ ਹੋਵੇਗਾ।', 'Safar tinn haftiaa da hovega.', 'The trip will be for three weeks.'),
    (script_id, para2_id, 5, 'ਮੈਨੂੰ ਇਸ ਸਫ਼ਰ ਦੀ ਬਹੁਤ ਬੇਸਬਰੀ ਨਾਲ ਉਡੀਕ ਹੈ।', 'Mainu is safar di bahut besabri naal udeek hai.', 'I can''t wait for this trip.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਅਸੀਂ ਕਿੱਥੇ ਜਾਣ ਦੀ ਯੋਜਨਾ ਬਣਾ ਰਹੇ ਹਾਂ? (Asi kitthe jaan di yojna bana rahe haa?)', 'ਦਿੱਲੀ (Delhi)', 'ਪੰਜਾਬ (Punjab)', 'ਮੁੰਬਈ (Mumbai)', 'Canada (Canada)', 'b', 0),
    (script_id, 'ਅਸੀਂ ਕਦੋਂ ਜਾਵਾਂਗੇ? (Asi kadon jaavaange?)', 'ਸਰਦੀਆਂ ਵਿੱਚ (sardiaa vich)', 'ਗਰਮੀਆਂ ਵਿੱਚ (garmiaa vich)', 'ਬਸੰਤ ਵਿੱਚ (basant vich)', 'ਸਾਰਾ ਸਾਲ (saara saal)', 'b', 1),
    (script_id, 'ਮਾਂ ਖੁਸ਼ ਕਿਉਂ ਹੈ? (Maa khush kiun hai?)', 'ਨਵੇਂ ਕੱਪੜੇ ਮਿਲਣਗੇ (nave kapre milange)', 'ਆਪਣੇ ਪਿੰਡ ਜਾ ਰਹੀ ਹੈ (apne pind ja rahi hai)', 'ਛੁੱਟੀ ਮਿਲੇਗੀ (chhutti milegi)', 'ਨਵੀਂ ਨੌਕਰੀ ਮਿਲੇਗੀ (navee naukri milegi)', 'b', 2),
    (script_id, 'ਸਫ਼ਰ ਕਿੰਨੇ ਹਫ਼ਤਿਆਂ ਦਾ ਹੋਵੇਗਾ? (Safar kinne haftiaa da hovega?)', 'ਦੋ (do)', 'ਤਿੰਨ (tinn)', 'ਚਾਰ (chaar)', 'ਪੰਜ (panj)', 'b', 3);

  -- ===========================================================================
  -- M3: A childhood memory
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A childhood memory',
    'Draft — pending native speaker review. Childhood with grandparents, past habitual + narrative. Access: paid.',
    'medium', 5, 18, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਜਦੋਂ ਮੈਂ ਛੋਟਾ ਸੀ, ਮੈਂ ਆਪਣੇ ਦਾਦਾ ਜੀ ਨਾਲ ਬਹੁਤ ਸਮਾਂ ਬਿਤਾਉਂਦਾ ਸੀ।', 'Jadoh mai chota si, mai apne dada ji naal bahut samaa bitaunda si.', 'When I was small, I used to spend a lot of time with my grandfather.'),
    (script_id, para1_id, 2, 'ਉਹ ਮੈਨੂੰ ਪੁਰਾਣੀਆਂ ਕਹਾਣੀਆਂ ਸੁਣਾਉਂਦੇ ਸੀ।', 'Oh mainu puraniaa kahaniaa sunaaunde si.', 'He used to tell me old stories.'),
    (script_id, para1_id, 3, 'ਗਰਮੀਆਂ ਦੀਆਂ ਛੁੱਟੀਆਂ ਵਿੱਚ ਅਸੀਂ ਪਿੰਡ ਜਾਂਦੇ ਸੀ।', 'Garmiaa diaa chhuttiaa vich asi pind jaande si.', 'In the summer holidays we used to go to the village.'),
    (script_id, para1_id, 4, 'ਮੈਂ ਖੇਤਾਂ ਵਿੱਚ ਦੌੜਦਾ ਸੀ।', 'Mai khetaa vich daudda si.', 'I used to run in the fields.'),
    (script_id, para1_id, 5, 'ਦਾਦੀ ਜੀ ਮੇਰੇ ਲਈ ਪਿੰਨੀਆਂ ਬਣਾਉਂਦੇ ਸੀ।', 'Daadi ji mere lai piniaa banaaunde si.', 'Grandmother used to make pinni (sweets) for me.'),
    (script_id, para2_id, 1, 'ਇੱਕ ਦਿਨ ਮੈਂ ਦਰੱਖਤ ਤੋਂ ਡਿੱਗ ਪਿਆ ਸੀ।', 'Ik din mai darakht toh digg piya si.', 'One day I had fallen from a tree.'),
    (script_id, para2_id, 2, 'ਮੈਨੂੰ ਬਹੁਤ ਸੱਟ ਲੱਗੀ ਸੀ।', 'Mainu bahut satt laggi si.', 'I had gotten badly hurt.'),
    (script_id, para2_id, 3, 'ਦਾਦਾ ਜੀ ਮੈਨੂੰ ਹਸਪਤਾਲ ਲੈ ਗਏ ਸੀ।', 'Dada ji mainu hspatal lai gae si.', 'Grandfather had taken me to the hospital.'),
    (script_id, para2_id, 4, 'ਉਸ ਦਿਨ ਤੋਂ ਬਾਅਦ ਮੈਂ ਬਹੁਤ ਸਾਵਧਾਨ ਹੋ ਗਿਆ ਸੀ।', 'Us din toh baad mai bahut saavdhaan ho gya si.', 'After that day I had become very careful.'),
    (script_id, para2_id, 5, 'ਹੁਣ ਵੀ ਜਦੋਂ ਮੈਂ ਪਿੰਡ ਜਾਂਦਾ ਹਾਂ, ਮੈਨੂੰ ਉਹ ਦਿਨ ਯਾਦ ਆਉਂਦੇ ਹਨ।', 'Hun vi jadoh mai pind jaanda haa, mainu oh din yaad aaunde han.', 'Even now when I go to the village, those days come to mind.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਮੈਂ ਕਿਸਦੇ ਨਾਲ ਸਮਾਂ ਬਿਤਾਉਂਦਾ ਸੀ? (Mai kisde naal samaa bitaunda si?)', 'ਦਾਦੀ (Daadi)', 'ਦਾਦਾ ਜੀ (Dada ji)', 'ਨਾਨਾ ਜੀ (Nana ji)', 'ਮਾਮਾ (Mama)', 'b', 0),
    (script_id, 'ਦਾਦੀ ਜੀ ਮੇਰੇ ਲਈ ਕੀ ਬਣਾਉਂਦੇ ਸੀ? (Daadi ji mere lai ki banaaunde si?)', 'ਪਰਾਂਠੇ (paraanthe)', 'ਪਿੰਨੀਆਂ (piniaa)', 'ਲੱਡੂ (laddoo)', 'ਹਲਵਾ (halwa)', 'b', 1),
    (script_id, 'ਮੈਂ ਕਿੱਥੋਂ ਡਿੱਗਿਆ? (Mai kitthoh diggiya?)', 'ਪੌੜੀਆਂ ਤੋਂ (paudiaa toh)', 'ਦਰੱਖਤ ਤੋਂ (darakht toh)', 'ਛੱਤ ਤੋਂ (chhat toh)', 'ਖੇਤ ਤੋਂ (khet toh)', 'b', 2),
    (script_id, 'ਮੈਨੂੰ ਹਸਪਤਾਲ ਕੌਣ ਲੈ ਗਿਆ? (Mainu hspatal kaun lai gya?)', 'ਦਾਦੀ ਜੀ (Daadi ji)', 'ਦਾਦਾ ਜੀ (Dada ji)', 'ਮਾਤਾ ਜੀ (Mata ji)', 'ਚਚਾ ji (Chacha ji)', 'b', 3);

  -- ===========================================================================
  -- M4: A visit to the doctor
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A visit to the doctor',
    'Draft — pending native speaker review. Past-tense doctor visit. Access: paid.',
    'medium', 4, 19, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਪਿਛਲੇ ਹਫ਼ਤੇ ਮੈਨੂੰ ਬੁਖ਼ਾਰ ਹੋ ਗਿਆ ਸੀ।', 'Pichhle hafte mainu bukhaar ho gya si.', 'Last week I had gotten a fever.'),
    (script_id, para1_id, 2, 'ਮੈਂ ਡਾਕਟਰ ਕੋਲ ਜਾਣ ਦਾ ਫ਼ੈਸਲਾ ਕੀਤਾ ਸੀ।', 'Mai daaktar kol jaan da faisla kita si.', 'I had decided to go to the doctor.'),
    (script_id, para1_id, 3, 'ਹਸਪਤਾਲ ਵਿੱਚ ਬਹੁਤ ਭੀੜ ਸੀ।', 'Hspatal vich bahut bheed si.', 'There was a big crowd at the hospital.'),
    (script_id, para1_id, 4, 'ਮੈਂ ਇੱਕ ਘੰਟਾ ਇੰਤਜ਼ਾਰ ਕੀਤਾ ਸੀ।', 'Mai ik ghanta intzaar kita si.', 'I had waited for one hour.'),
    (script_id, para1_id, 5, 'ਆਖ਼ਰਕਾਰ ਮੇਰੀ ਵਾਰੀ ਆਈ ਸੀ।', 'Aakhirkaar meri vaari aai si.', 'Finally my turn had come.'),
    (script_id, para2_id, 1, 'ਡਾਕਟਰ ਨੇ ਮੇਰੀ ਜਾਂਚ ਕੀਤੀ ਸੀ।', 'Daaktar ne meri jaanch kiti si.', 'The doctor had examined me.'),
    (script_id, para2_id, 2, 'ਉਸਨੇ ਮੈਨੂੰ ਦਵਾਈ ਅਤੇ ਆਰਾਮ ਕਰਨ ਲਈ ਕਿਹਾ ਸੀ।', 'Usne mainu davai ate aaraam karan lai kiha si.', 'They had told me to take medicine and rest.'),
    (script_id, para2_id, 3, 'ਮੈਂ ਤਿੰਨ ਦਿਨ ਘਰ ਰਿਹਾ ਸੀ।', 'Mai tinn din ghar rihaa si.', 'I had stayed home for three days.'),
    (script_id, para2_id, 4, 'ਹੌਲੀ-ਹੌਲੀ ਮੈਂ ਠੀਕ ਹੋ ਗਿਆ ਸੀ।', 'Hauli-hauli mai theek ho gya si.', 'Slowly I had gotten better.'),
    (script_id, para2_id, 5, 'ਹੁਣ ਮੈਂ ਪੂਰੀ ਤਰ੍ਹਾਂ ਤੰਦਰੁਸਤ ਹਾਂ।', 'Hun mai poori tarhaa tandurust haa.', 'Now I am completely healthy.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਮੈਨੂੰ ਕੀ ਹੋਇਆ ਸੀ? (Mainu ki hoiya si?)', 'ਸਿਰ ਦਰਦ (sir dard)', 'ਬੁਖ਼ਾਰ (bukhaar)', 'ਖੰਘ (khangh)', 'ਪੇਟ ਦਰਦ (pet dard)', 'b', 0),
    (script_id, 'ਮੈਂ ਕਿੰਨੀ ਦੇਰ ਇੰਤਜ਼ਾਰ ਕੀਤਾ? (Mai kinni der intzaar kita?)', 'ਅੱਧਾ ਘੰਟਾ (adhaa ghanta)', 'ਇੱਕ ਘੰਟਾ (ik ghanta)', 'ਦੋ ਘੰਟੇ (do ghante)', 'ਤਿੰਨ ਘੰਟੇ (tinn ghante)', 'b', 1),
    (script_id, 'ਡਾਕਟਰ ਨੇ ਕੀ ਕਿਹਾ? (Daaktar ne ki kiha?)', 'ਹਸਪਤਾਲ ਵਿੱਚ ਰਹਿਣ ਲਈ (hspatal vich rehan lai)', 'ਦਵਾਈ ਅਤੇ ਆਰਾਮ ਕਰਨ ਲਈ (davai ate aaraam karan lai)', 'ਕੰਮ ''ਤੇ ਜਾਣ ਲਈ (kaam te jaan lai)', 'ਦੁਬਾਰਾ ਚੈਕਅੱਪ ਲਈ (dubaara checkup lai)', 'b', 2),
    (script_id, 'ਮੈਂ ਕਿੰਨੇ ਦਿਨ ਘਰ ਰਿਹਾ? (Mai kinne din ghar rihaa?)', 'ਦੋ (do)', 'ਤਿੰਨ (tinn)', 'ਪੰਜ (panj)', 'ਇੱਕ (ik)', 'b', 3);

  -- ===========================================================================
  -- M5: Celebrating Vaisakhi with family
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Celebrating Vaisakhi with family',
    'Draft — pending native speaker review. Vaisakhi: present general + past last year. Access: paid.',
    'medium', 4, 20, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਵਿਸਾਖੀ ਸਾਡੇ ਪਰਿਵਾਰ ਦਾ ਸਭ ਤੋਂ ਪਿਆਰਾ ਤਿਉਹਾਰ ਹੈ।', 'Vaisakhi saade parivar da sab toh piyaara tiuhaar hai.', 'Vaisakhi is our family''s most beloved festival.'),
    (script_id, para1_id, 2, 'ਅਸੀਂ ਸਵੇਰੇ ਜਲਦੀ ਉੱਠ ਕੇ ਗੁਰਦੁਆਰੇ ਜਾਂਦੇ ਹਾਂ।', 'Asi savere jaldi utth ke gurduare jaande haa.', 'We wake up early and go to the gurdwara.'),
    (script_id, para1_id, 3, 'ਨਗਰ ਕੀਰਤਨ ਵਿੱਚ ਸਾਰਾ ਪਿੰਡ ਸ਼ਾਮਲ ਹੁੰਦਾ ਹੈ।', 'Nagar keertan vich saara pind shaamal hunda hai.', 'The whole village joins the nagar keertan.'),
    (script_id, para1_id, 4, 'ਬੱਚੇ ਗਿੱਧਾ ਅਤੇ ਭੰਗੜਾ ਦੇਖਦੇ ਹਨ।', 'Bacche giddha ate bhangra dekhde han.', 'The children watch giddha and bhangra.'),
    (script_id, para1_id, 5, 'ਹਰ ਕੋਈ ਨਵੇਂ ਕੱਪੜੇ ਪਾਉਂਦਾ ਹੈ।', 'Har koi nave kapre paunda hai.', 'Everyone wears new clothes.'),
    (script_id, para2_id, 1, 'ਪਿਛਲੇ ਸਾਲ ਅਸੀਂ ਸਾਰੇ ਰਿਸ਼ਤੇਦਾਰ ਇਕੱਠੇ ਹੋਏ ਸੀ।', 'Pichhle saal asi saare rishtedaar ikatthe hoe si.', 'Last year all our relatives had gathered together.'),
    (script_id, para2_id, 2, 'ਅਸੀਂ ਵਿਹੜੇ ਵਿੱਚ ਖਾਣਾ ਬਣਾਇਆ ਸੀ।', 'Asi vehde vich khana banaiya si.', 'We had made food in the courtyard.'),
    (script_id, para2_id, 3, 'ਸਾਰਿਆਂ ਨੇ ਮਿਲ ਕੇ ਭੰਗੜਾ ਪਾਇਆ ਸੀ।', 'Saariaa ne mil ke bhangra paaiya si.', 'Everyone had danced bhangra together.'),
    (script_id, para2_id, 4, 'ਬੱਚਿਆਂ ਨੇ ਪਟਾਕੇ ਚਲਾਏ ਸੀ।', 'Bacchiaa ne pataake chalae si.', 'The children had set off firecrackers.'),
    (script_id, para2_id, 5, 'ਉਹ ਦਿਨ ਹਾਸੇ ਅਤੇ ਖੁਸ਼ੀ ਨਾਲ ਭਰਿਆ ਹੋਇਆ ਸੀ।', 'Oh din haase ate khushi naal bhariya hoiya si.', 'That day was filled with laughter and happiness.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਵਿਸਾਖੀ ਵਾਲੇ ਦਿਨ ਅਸੀਂ ਕਿੱਥੇ ਜਾਂਦੇ ਹਾਂ? (Vaisakhi vaale din asi kitthe jaande haa?)', 'ਬਜ਼ਾਰ (bazaar)', 'ਗੁਰਦੁਆਰੇ (gurduare)', 'ਸਕੂਲ (school)', 'ਪਾਰਕ (park)', 'b', 0),
    (script_id, 'ਬੱਚੇ ਕੀ ਦੇਖਦੇ ਹਨ? (Bacche ki dekhde han?)', 'ਫ਼ਿਲਮ (film)', 'ਗਿੱਧਾ ਅਤੇ ਭੰਗੜਾ (giddha ate bhangra)', 'ਕ੍ਰਿਕਟ (cricket)', 'ਕੀਰਤਨ (keertan)', 'b', 1),
    (script_id, 'ਪਿਛਲੇ ਸਾਲ ਖਾਣਾ ਕਿੱਥੇ ਬਣਾਇਆ ਗਿਆ? (Pichhle saal khana kitthe banaiya gya?)', 'ਰਸੋਈ ਵਿੱਚ (rasoi vich)', 'ਵਿਹੜੇ ਵਿੱਚ (vehde vich)', 'ਗੁਰਦੁਆਰੇ ਵਿੱਚ (gurduare vich)', 'ਬਜ਼ਾਰ ਵਿੱਚ (bazaar vich)', 'b', 2),
    (script_id, 'ਬੱਚਿਆਂ ਨੇ ਕੀ ਚਲਾਏ? (Bacchiaa ne ki chalae?)', 'ਪਟਾਕੇ (pataake)', 'ਗੱਡੀਆਂ (gadiaa)', 'ਪਤੰਗ (patang)', 'ਦੀਵੇ (diye)', 'a', 3);

  -- ===========================================================================
  -- M6: Catching up with a grandparent on the phone
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Catching up with a grandparent on the phone',
    'Draft — pending native speaker review. Present habit + past phone call with naana ji. Access: paid.',
    'medium', 4, 21, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਹਰ ਐਤਵਾਰ ਮੈਂ ਆਪਣੇ ਨਾਨਾ ਜੀ ਨੂੰ ਫ਼ੋਨ ਕਰਦਾ ਹਾਂ।', 'Har aitvaar mai apne naana ji nu phone karda haa.', 'Every Sunday I call my (maternal) grandfather.'),
    (script_id, para1_id, 2, 'ਉਹ ਹਮੇਸ਼ਾ ਮੇਰੀ ਪੜ੍ਹਾਈ ਬਾਰੇ ਪੁੱਛਦੇ ਹਨ।', 'Oh hamesha meri parhai baare puchde han.', 'He always asks about my studies.'),
    (script_id, para1_id, 3, 'ਮੈਂ ਉਹਨਾਂ ਨੂੰ ਆਪਣੇ ਦੋਸਤਾਂ ਬਾਰੇ ਦੱਸਦਾ ਹਾਂ।', 'Mai ohnaa nu apne dostaa baare dassda haa.', 'I tell him about my friends.'),
    (script_id, para1_id, 4, 'ਉਹ ਮੈਨੂੰ ਪੰਜਾਬੀ ਵਿੱਚ ਗੱਲ ਕਰਨ ਲਈ ਕਹਿੰਦੇ ਹਨ।', 'Oh mainu Punjabi vich gall karan lai kehnde han.', 'He tells me to speak in Punjabi.'),
    (script_id, para1_id, 5, 'ਮੈਨੂੰ ਇਹ ਗੱਲਾਂ ਬਹੁਤ ਪਸੰਦ ਹਨ।', 'Mainu ih gallaa bahut pasand han.', 'I like these conversations a lot.'),
    (script_id, para2_id, 1, 'ਪਿਛਲੇ ਹਫ਼ਤੇ ਉਹਨਾਂ ਨੇ ਆਪਣੇ ਬਚਪਨ ਦੀਆਂ ਗੱਲਾਂ ਦੱਸੀਆਂ ਸੀ।', 'Pichhle hafte ohnaa ne apne bachpan diaa gallaa dassiaa si.', 'Last week he had told me stories about his own childhood.'),
    (script_id, para2_id, 2, 'ਉਹ ਪਿੰਡ ਵਿੱਚ ਖੇਤੀ ਕਰਦੇ ਸੀ।', 'Oh pind vich kheti karde si.', 'He used to farm in the village.'),
    (script_id, para2_id, 3, 'ਉਹਨਾਂ ਦੀ ਆਵਾਜ਼ ਸੁਣ ਕੇ ਮੈਨੂੰ ਬਹੁਤ ਸਕੂਨ ਮਿਲਿਆ ਸੀ।', 'Ohnaa di aavaaz sun ke mainu bahut sakoon miliya si.', 'Hearing his voice had given me a lot of comfort.'),
    (script_id, para2_id, 4, 'ਅਸੀਂ ਇੱਕ ਘੰਟੇ ਤੋਂ ਵੱਧ ਗੱਲ ਕੀਤੀ ਸੀ।', 'Asi ik ghante toh vadh gall kiti si.', 'We had talked for more than an hour.'),
    (script_id, para2_id, 5, 'ਮੈਂ ਜਲਦੀ ਹੀ ਉਹਨਾਂ ਨੂੰ ਮਿਲਣ ਜਾਣਾ ਚਾਹੁੰਦਾ ਹਾਂ।', 'Mai jaldi hi ohnaa nu milan jaana chahunda haa.', 'I want to go meet him soon.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਮੈਂ ਹਰ ਐਤਵਾਰ ਕਿਸਨੂੰ ਫ਼ੋਨ ਕਰਦਾ ਹਾਂ? (Mai har aitvaar kisnu phone karda haa?)', 'ਨਾਨੀ ਜੀ (Naani ji)', 'ਨਾਨਾ ਜੀ (Naana ji)', 'ਦਾਦਾ ਜੀ (Dada ji)', 'ਚਚਾ ji (Chacha ji)', 'b', 0),
    (script_id, 'ਨਾਨਾ ਜੀ ਕੀ ਪੁੱਛਦੇ ਹਨ? (Naana ji ki puchde han?)', 'ਪੜ੍ਹਾਈ ਬਾਰੇ (parhai baare)', 'ਖਾਣੇ ਬਾਰੇ (khaane baare)', 'ਪੈਸਿਆਂ ਬਾਰੇ (paisiaa baare)', 'ਖੇਡ ਬਾਰੇ (khed baare)', 'a', 1),
    (script_id, 'ਨਾਨਾ ਜੀ ਪਿੰਡ ਵਿੱਚ ਕੀ ਕਰਦੇ ਸੀ? (Naana ji pind vich ki karde si?)', 'ਪੜ੍ਹਾਈ (parhai)', 'ਖੇਤੀ (kheti)', 'ਦੁਕਾਨ (dukaan)', 'ਨੌਕਰੀ (naukri)', 'b', 2),
    (script_id, 'ਪਿਛਲੇ ਹਫ਼ਤੇ ਅਸੀਂ ਕਿੰਨੀ ਦੇਰ ਗੱਲ ਕੀਤੀ? (Pichhle hafte asi kinni der gall kiti?)', 'ਅੱਧਾ ਘੰਟਾ (adhaa ghanta)', 'ਇੱਕ ਘੰਟੇ ਤੋਂ ਵੱਧ (ik ghante toh vadh)', 'ਦਸ ਮਿੰਟ (das minute)', 'ਦੋ ਘੰਟੇ (do ghante)', 'b', 3);

  -- ===========================================================================
  -- M7: Cooking a family recipe together
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Cooking a family recipe together',
    'Draft — pending native speaker review. Past-tense making sarson da saag. Access: paid.',
    'medium', 4, 22, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਪਿਛਲੇ ਐਤਵਾਰ ਮੈਂ ਅਤੇ ਮੇਰੀ ਮਾਂ ਨੇ ਸਰੋਂ ਦਾ ਸਾਗ ਬਣਾਇਆ ਸੀ।', 'Pichhle aitvaar mai ate meri maa ne saroh da saag banaiya si.', 'Last Sunday my mother and I had made sarson da saag.'),
    (script_id, para1_id, 2, 'ਪਹਿਲਾਂ ਅਸੀਂ ਸਾਗ ਧੋਇਆ ਸੀ।', 'Pehlaa asi saag dhoiya si.', 'First we had washed the greens.'),
    (script_id, para1_id, 3, 'ਫਿਰ ਮਾਂ ਨੇ ਮੈਨੂੰ ਸਬਜ਼ੀਆਂ ਕੱਟਣੀਆਂ ਸਿਖਾਈਆਂ ਸੀ।', 'Phir maa ne mainu sabziaa kattniaa sikhaiaa si.', 'Then mother had taught me to chop the vegetables.'),
    (script_id, para1_id, 4, 'ਅਸੀਂ ਦੋ ਘੰਟੇ ਸਾਗ ਪਕਾਇਆ ਸੀ।', 'Asi do ghante saag pakaiya si.', 'We had cooked the saag for two hours.'),
    (script_id, para1_id, 5, 'ਪੂਰੇ ਘਰ ਵਿੱਚ ਖ਼ੁਸ਼ਬੂ ਫੈਲ ਗਈ ਸੀ।', 'Poore ghar vich khushboo phail gai si.', 'The fragrance had spread through the whole house.'),
    (script_id, para2_id, 1, 'ਅਸੀਂ ਮੱਕੀ ਦੀ ਰੋਟੀ ਵੀ ਬਣਾਈ ਸੀ।', 'Asi makki di roti vi banai si.', 'We had also made makki di roti (corn flatbread).'),
    (script_id, para2_id, 2, 'ਮਾਂ ਨੇ ਦੱਸਿਆ ਸੀ ਕਿ ਇਹ ਵਿਅੰਜਨ ਸਾਡੀ ਦਾਦੀ ਜੀ ਤੋਂ ਆਇਆ ਹੈ।', 'Maa ne dassiya si ki ih vianjan saadi daadi ji toh aaiya hai.', 'Mother had told me this recipe came from our grandmother.'),
    (script_id, para2_id, 3, 'ਸਾਰੇ ਪਰਿਵਾਰ ਨੇ ਮਿਲ ਕੇ ਖਾਣਾ ਖਾਧਾ ਸੀ।', 'Saare parivar ne mil ke khana khadha si.', 'The whole family had eaten together.'),
    (script_id, para2_id, 4, 'ਸਾਰਿਆਂ ਨੇ ਖਾਣੇ ਦੀ ਬਹੁਤ ਤਾਰੀਫ਼ ਕੀਤੀ ਸੀ।', 'Saariaa ne khaane di bahut taarif kiti si.', 'Everyone had praised the food a lot.'),
    (script_id, para2_id, 5, 'ਹੁਣ ਮੈਨੂੰ ਵੀ ਇਹ ਪਕਵਾਨ ਬਣਾਉਣਾ ਆਉਂਦਾ ਹੈ।', 'Hun mainu vi ih pakvaan banaunaa aaunda hai.', 'Now I also know how to make this dish.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਅਸੀਂ ਕੀ ਬਣਾਇਆ? (Asi ki banaiya?)', 'ਦਾਲ (daal)', 'ਸਰੋਂ ਦਾ ਸਾਗ (saroh da saag)', 'ਪਨੀਰ (paneer)', 'ਰੋਟੀ (roti)', 'b', 0),
    (script_id, 'ਸਾਗ ਪਕਾਉਣ ਵਿੱਚ ਕਿੰਨਾ ਸਮਾਂ ਲੱਗਿਆ? (Saag pakaaunn vich kinna samaa laggiya?)', 'ਇੱਕ ਘੰਟਾ (ik ghanta)', 'ਦੋ ਘੰਟੇ (do ghante)', 'ਤਿੰਨ ਘੰਟੇ (tinn ghante)', 'ਅੱਧਾ ਘੰਟਾ (adhaa ghanta)', 'b', 1),
    (script_id, 'ਇਹ ਵਿਅੰਜਨ ਕਿਸ ਤੋਂ ਆਇਆ? (Ih vianjan kis toh aaiya?)', 'ਨਾਨੀ ਜੀ (Naani ji)', 'ਦਾਦੀ ਜੀ (Daadi ji)', 'ਮਾਸੀ (Maasi)', 'ਮਾਮਾ (Mama)', 'b', 2),
    (script_id, 'ਹੁਣ ਮੈਨੂੰ ਕੀ ਆਉਂਦਾ ਹੈ? (Hun mainu ki aaunda hai?)', 'ਇਹ ਪਕਵਾਨ ਬਣਾਉਣਾ (ih pakvaan banaunaa)', 'ਗੱਡੀ ਚਲਾਉਣਾ (gaddi chalaunaa)', 'ਗਾਉਣਾ (gaaunaa)', 'ਨਾਚਣਾ (naachna)', 'a', 3);

  -- ===========================================================================
  -- M8: A day that didn't go to plan
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A day that didn''t go to plan',
    'Draft — pending native speaker review. Past-tense bad day at work. Access: paid.',
    'medium', 5, 23, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਕੱਲ੍ਹ ਮੇਰਾ ਦਿਨ ਬਹੁਤ ਖਰਾਬ ਰਿਹਾ ਸੀખ4', 'Kallh mera din bahut kharab rihaa si.', 'Yesterday my day had been very bad.'),
    (script_id, para1_id, 2, 'ਸਵੇਰੇ ਮੇਰਾ ਅਲਾਰਮ ਨਹੀਂ ਵੱਜਿਆ ਸੀ।', 'Savere mera alarm nahi vajjiya si.', 'In the morning my alarm hadn''t rung.'),
    (script_id, para1_id, 3, 'ਮੈਂ ਦੇਰ ਨਾਲ ਉੱਠਿਆ ਸੀ।', 'Mai der naal utthiya si.', 'I had woken up late.'),
    (script_id, para1_id, 4, 'ਮੈਂ ਜਲਦੀ-ਜਲਦੀ ਤਿਆਰ ਹੋਇਆ ਸੀ।', 'Mai jaldi-jaldi tiaar hoiya si.', 'I had gotten ready very quickly.'),
    (script_id, para1_id, 5, 'ਪਰ ਬੱਸ ਪਹਿਲਾਂ ਹੀ ਨਿਕਲ ਗਈ ਸੀ।', 'Par bus pehlaa hi nikal gai si.', 'But the bus had already left.'),
    (script_id, para2_id, 1, 'ਮੈਨੂੰ ਟੈਕਸੀ ਲੈਣੀ ਪਈ ਸੀ।', 'Mainu taxi lainee pai si.', 'I had to take a taxi.'),
    (script_id, para2_id, 2, 'ਰਸਤੇ ਵਿੱਚ ਬਹੁਤ ਟ੍ਰੈਫ਼ਿਕ ਸੀ।', 'Raste vich bahut traffic si.', 'There was a lot of traffic on the way.'),
    (script_id, para2_id, 3, 'ਮੈਂ ਦਫ਼ਤਰ ਇੱਕ ਘੰਟਾ ਦੇਰ ਨਾਲ ਪਹੁੰਚਿਆ ਸੀ।', 'Mai daftar ik ghanta der naal pahunchiya si.', 'I had arrived at the office one hour late.'),
    (script_id, para2_id, 4, 'ਮੇਰੇ ਬੌਸ ਨੇ ਕੁਝ ਨਹੀਂ ਕਿਹਾ, ਪਰ ਮੈਂ ਸ਼ਰਮਿੰਦਾ ਮਹਿਸੂਸ ਕੀਤਾ ਸੀ।', 'Mere boss ne kujh nahi kiha, par mai sharminda mehsoos kita si.', 'My boss said nothing, but I had felt embarrassed.'),
    (script_id, para2_id, 5, 'ਮੈਂ ਸੋਚਿਆ ਕਿ ਕੱਲ੍ਹ ਤੋਂ ਦੋ ਅਲਾਰਮ ਲਗਾਵਾਂਗਾ।', 'Mai sochiya ki kallh toh do alarm lagaavaanga.', 'I thought that from tomorrow I''ll set two alarms.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਸਵੇਰੇ ਕੀ ਹੋਇਆ? (Savere ki hoiya?)', 'ਬੱਸ ਜਲਦੀ ਆਈ (bus jaldi aai)', 'ਅਲਾਰਮ ਨਹੀਂ ਵੱਜਿਆ (alarm nahi vajjiya)', 'ਬਿਜਲੀ ਚਲੀ ਗਈ (bijli chali gai)', 'ਬਾਰਿਸ਼ ਹੋ ਗਈ (baarish ho gai)', 'b', 0),
    (script_id, 'ਮੈਨੂੰ ਕੀ ਲੈਣਾ ਪਿਆ? (Mainu ki lainaa piya?)', 'ਬੱਸ (bus)', 'ਟੈਕਸੀ (taxi)', 'ਸਾਈਕਲ (cycle)', 'ਟ੍ਰੇਨ (train)', 'b', 1),
    (script_id, 'ਮੈਂ ਦਫ਼ਤਰ ਕਿੰਨੀ ਦੇਰ ਨਾਲ ਪਹੁੰਚਿਆ? (Mai daftar kinni der naal pahunchiya?)', 'ਅੱਧਾ ਘੰਟਾ (adhaa ghanta)', 'ਇੱਕ ਘੰਟਾ (ik ghanta)', 'ਦੋ ਘੰਟੇ (do ghante)', 'ਤਿੰਨ ਘੰਟੇ (tinn ghante)', 'b', 2),
    (script_id, 'ਮੈਂ ਕੀ ਸੋਚਿਆ? (Mai ki sochiya?)', 'ਨੌਕਰੀ ਛੱਡਣ ਬਾਰੇ (naukri chhadan baare)', 'ਦੋ ਅਲਾਰਮ ਲਗਾਉਣ ਬਾਰੇ (do alarm lagaaunn baare)', 'ਦੇਰ ਨਾਲ ਸੌਣ ਬਾਰੇ (der naal saunn baare)', 'ਛੁੱਟੀ ਲੈਣ ਬਾਰੇ (chhutti lain baare)', 'b', 3);

  -- ===========================================================================
  -- M9: Starting a new job or course
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Starting a new job or course',
    'Draft — pending native speaker review. New job: past first week + present settling in. Access: paid.',
    'medium', 5, 24, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਇਸ ਮਹੀਨੇ ਮੈਂ ਇੱਕ ਨਵੀਂ ਨੌਕਰੀ ਸ਼ੁਰੂ ਕੀਤੀ ਹੈ।', 'Is mahine mai ik navee naukri shuru kiti hai.', 'This month I have started a new job.'),
    (script_id, para1_id, 2, 'ਪਹਿਲੇ ਦਿਨ ਮੈਂ ਬਹੁਤ ਘਬਰਾਇਆ ਹੋਇਆ ਸੀ।', 'Pehle din mai bahut ghabraiya hoiya si.', 'On the first day I had been very nervous.'),
    (script_id, para1_id, 3, 'ਮੇਰੇ ਸਾਥੀਆਂ ਨੇ ਮੇਰਾ ਸਵਾਗਤ ਕੀਤਾ ਸੀ।', 'Mere saathiaa ne mera swaagat kita si.', 'My colleagues had welcomed me.'),
    (script_id, para1_id, 4, 'ਮੈਨੂੰ ਆਪਣਾ ਡੈਸਕ ਅਤੇ ਕੰਪਿਊਟਰ ਦਿੱਤਾ ਗਿਆ ਸੀ।', 'Mainu apna desk ate computer ditta gya si.', 'I had been given my own desk and computer.'),
    (script_id, para1_id, 5, 'ਮੇਰੇ ਬੌਸ ਨੇ ਮੈਨੂੰ ਕੰਮ ਸਮਝਾਇਆ ਸੀ।', 'Mere boss ne mainu kaam samjhaiya si.', 'My boss had explained the work to me.'),
    (script_id, para2_id, 1, 'ਪਹਿਲਾ ਹਫ਼ਤਾ ਸਿੱਖਣ ਵਿੱਚ ਹੀ ਲੰਘਿਆ ਸੀ।', 'Pehla hafta sikhan vich hi langhiya si.', 'The first week had passed just in learning.'),
    (script_id, para2_id, 2, 'ਹੁਣ ਮੈਂ ਹੌਲੀ-ਹੌਲੀ ਆਦਤ ਪਾ ਰਿਹਾ ਹਾਂ।', 'Hun mai hauli-hauli aadat pa rihaa haa.', 'Now I''m slowly getting used to it.'),
    (script_id, para2_id, 3, 'ਮੇਰੇ ਸਹਿਕਰਮੀ ਬਹੁਤ ਮਦਦਗਾਰ ਹਨ।', 'Mere sehkarmi bahut madadgaar han.', 'My co-workers are very helpful.'),
    (script_id, para2_id, 4, 'ਕੰਮ ਥੋੜ੍ਹਾ ਔਖਾ ਹੈ ਪਰ ਦਿਲਚਸਪ ਵੀ ਹੈ।', 'Kaam thoda aukha hai par dilchasp vi hai.', 'The work is a bit hard but also interesting.'),
    (script_id, para2_id, 5, 'ਮੈਨੂੰ ਵਿਸ਼ਵਾਸ ਹੈ ਕਿ ਮੈਂ ਇੱਥੇ ਬਹੁਤ ਕੁਝ ਸਿੱਖਾਂਗਾ।', 'Mainu vishvaas hai ki mai itthe bahut kujh sikhaanga.', 'I believe I''ll learn a lot here.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਪਹਿਲੇ ਦਿਨ ਮੈਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕੀਤਾ? (Pehle din mai kiven mehsoos kita?)', 'ਖੁਸ਼ (khush)', 'ਘਬਰਾਇਆ (ghabraiya)', 'ਬੋਰ (bore)', 'ਥੱਕਿਆ (thakkiya)', 'b', 0),
    (script_id, 'ਮੈਨੂੰ ਕੀ ਦਿੱਤਾ ਗਿਆ? (Mainu ki ditta gya?)', 'ਗੱਡੀ (gaddi)', 'ਡੈਸਕ ਅਤੇ ਕੰਪਿਊਟਰ (desk ate computer)', 'ਘਰ (ghar)', 'ਫ਼ੋਨ (phone)', 'b', 1),
    (script_id, 'ਪਹਿਲਾ ਹਫ਼ਤਾ ਕਿਵੇਂ ਲੰਘਿਆ? (Pehla hafta kiven langhiya?)', 'ਸਿੱਖਣ ਵਿੱਚ (sikhan vich)', 'ਆਰਾਮ ਵਿੱਚ (aaraam vich)', 'ਛੁੱਟੀ ਵਿੱਚ (chhutti vich)', 'ਕੰਮ ਵਿੱਚ (kaam vich)', 'a', 2),
    (script_id, 'ਕੰਮ ਕਿਹੋ ਜਿਹਾ ਹੈ? (Kaam kiho jiha hai?)', 'ਬਹੁਤ ਸੌਖਾ (bahut saukha)', 'ਔਖਾ ਪਰ ਦਿਲਚਸਪ (aukha par dilchasp)', 'ਬੋਰਿੰਗ (boring)', 'ਬਹੁਤ ਆਸਾਨ (bahut aasan)', 'b', 3);

  -- ===========================================================================
  -- M10: A misunderstanding between friends
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A misunderstanding between friends',
    'Draft — pending native speaker review. Past-tense misunderstanding with a friend. Access: paid.',
    'medium', 5, 25, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਪਿਛਲੇ ਹਫ਼ਤੇ ਮੇਰੀ ਦੋਸਤ ਨਾਲ ਇੱਕ ਗ਼ਲਤਫ਼ਹਿਮੀ ਹੋ ਗਈ ਸੀ।', 'Pichhle hafte meri dost naal ik galatfehmi ho gai si.', 'Last week a misunderstanding had happened with my friend.'),
    (script_id, para1_id, 2, 'ਮੈਂ ਉਸਨੂੰ ਇੱਕ ਸੁਨੇਹਾ ਭੇਜਿਆ ਸੀ ਪਰ ਉਸਨੇ ਜਵਾਬ ਨਹੀਂ ਦਿੱਤਾ ਸੀ।', 'Mai usnu ik sunehaa bhejiya si par usne javaab nahi ditta si.', 'I had sent her a message but she hadn''t replied.'),
    (script_id, para1_id, 3, 'ਮੈਂ ਸੋਚਿਆ ਕਿ ਉਹ ਮੇਰੇ ਨਾਲ ਗੁੱਸੇ ਹੈ।', 'Mai sochiya ki oh mere naal gusse hai.', 'I thought she was angry with me.'),
    (script_id, para1_id, 4, 'ਮੈਂ ਵੀ ਉਸ ਨਾਲ ਗੱਲ ਕਰਨੀ ਬੰਦ ਕਰ ਦਿੱਤੀ ਸੀ।', 'Mai vi us naal gall karnee band kar ditti si.', 'I had also stopped talking to her.'),
    (script_id, para1_id, 5, 'ਦੋ ਦਿਨ ਅਸੀਂ ਇੱਕ-ਦੂਜੇ ਨਾਲ ਗੱਲ ਨਹੀਂ ਕੀਤੀ ਸੀ।', 'Do din asi ik-dooje naal gall nahi kiti si.', 'For two days we hadn''t talked to each other.'),
    (script_id, para2_id, 1, 'ਫਿਰ ਮੈਨੂੰ ਪਤਾ ਲੱਗਿਆ ਕਿ ਉਸਦਾ ਫ਼ੋਨ ਖ਼ਰਾਬ ਹੋ ਗਿਆ ਸੀ।', 'Phir mainu pataa laggiya ki usda phone kharab ho gya si.', 'Then I found out her phone had broken.'),
    (script_id, para2_id, 2, 'ਉਸਨੂਂ ਮੇਰਾ ਸੁਨੇਹਾ ਮਿਲਿਆ ਹੀ ਨਹੀਂ ਸੀખ4', 'Usnu mera sunehaa miliya hi nahi si.', 'She hadn''t even received my message.'),
    (script_id, para2_id, 3, 'ਅਸੀਂ ਦੋਵਾਂ ਨੇ ਮਿਲ ਕੇ ਗੱਲ ਕੀਤੀ ਸੀ।', 'Asi dovaa ne mil ke gall kiti si.', 'Both of us had met and talked.'),
    (script_id, para2_id, 4, 'ਸਾਨੂੰ ਪਤਾ ਲੱਗਿਆ ਕਿ ਇਹ ਸਿਰਫ਼ ਇੱਕ ਗ਼ਲਤਫ਼ਹਿਮੀ ਸੀ।', 'Saanu pataa laggiya ki ih sirf ik galatfehmi si.', 'We found out it was just a misunderstanding.'),
    (script_id, para2_id, 5, 'ਹੁਣ ਅਸੀਂ ਪਹਿਲਾਂ ਨਾਲੋਂ ਵੀ ਚੰਗੇ ਦੋਸਤ ਹਾਂ।', 'Hun asi pehlaa naaloh vi changge dost haa.', 'Now we''re even better friends than before.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਮੈਂ ਦੋਸਤ ਨੂੰ ਕੀ ਭੇਜਿਆ? (Mai dost nu ki bhejiya?)', 'ਫ਼ੋਨ ਕਾਲ (phone call)', 'ਸੁਨੇਹਾ (sunehaa)', 'ਤੋਹਫ਼ਾ (tohfa)', 'ਈਮੇਲ (email)', 'b', 0),
    (script_id, 'ਮੈਂ ਕੀ ਸੋਚਿਆ? (Mai ki sochiya?)', 'ਉਹ ਬਿਮਾਰ ਹੈ (oh bimaar hai)', 'ਉਹ ਗੁੱਸੇ ਹੈ (oh gusse hai)', 'ਉਹ ਬਾਹਰ ਗਈ ਹੈ (oh bahar gai hai)', 'ਉਹ ਵਿਅਸਤ ਹੈ (oh viast hai)', 'b', 1),
    (script_id, 'ਅਸਲੀ ਕਾਰਨ ਕੀ ਸੀ? (Asli kaaran ki si?)', 'ਦੋਸਤ ਗੁੱਸੇ ਸੀ (dost gusse si)', 'ਫ਼ੋਨ ਖ਼ਰਾਬ ਹੋ ਗਿਆ ਸੀ (phone kharab ho gya si)', 'ਦੋਸਤ ਵਿਅਸਤ ਸੀ (dost viast si)', 'ਸੁਨੇਹਾ ਨਹੀਂ ਮਿਲਿਆ (sunehaa nahi miliya)', 'b', 2),
    (script_id, 'ਹੁਣ ਦੋਸਤੀ ਕਿਹੋ ਜਿਹੀ ਹੈ? (Hun dosti kiho jihi hai?)', 'ਖ਼ਤਮ (khatam)', 'ਪਹਿਲਾਂ ਨਾਲੋਂ ਚੰਗੀ (pehlaa naaloh changgi)', 'ਉਹੀ ਜਿਹੀ (ohi jihi)', 'ਥੋੜ੍ਹੀ ਖਰਾਬ (thodi kharab)', 'b', 3);

  -- ===========================================================================
  -- M11: Moving to a new house
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Moving to a new house',
    'Draft — pending native speaker review. Past-tense move to a new home. Access: paid.',
    'medium', 5, 26, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO para1_id;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO para2_id;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, para1_id, 1, 'ਪਿਛਲੇ ਮਹੀਨੇ ਅਸੀਂ ਨਵੇਂ ਘਰ ਵਿੱਚ ਸ਼ਿਫ਼ਟ ਹੋਏ ਸੀ।', 'Pichhle mahine asi nave ghar vich shift hoe si.', 'Last month we had shifted to a new house.'),
    (script_id, para1_id, 2, 'ਸਾਮਾਨ ਪੈਕ ਕਰਨ ਵਿੱਚ ਸਾਨੂੰ ਪੂਰਾ ਹਫ਼ਤਾ ਲੱਗਿਆ ਸੀ।', 'Saamaan pack karan vich saanu poora hafta laggiya si.', 'Packing the belongings had taken us a whole week.'),
    (script_id, para1_id, 3, 'ਟਰੱਕ ਸਵੇਰੇ ਸੱਤ ਵਜੇ ਆਇਆ ਸੀ।', 'Truck savere satt vaje aaiya si.', 'The truck had come at seven in the morning.'),
    (script_id, para1_id, 4, 'ਸਾਰਾ ਪਰਿਵਾਰ ਸਾਮਾਨ ਲੱਦਣ ਵਿੱਚ ਲੱਗਾ ਸੀ।', 'Saara parivar saamaan laddan vich lagga si.', 'The whole family had been busy loading the belongings.'),
    (script_id, para1_id, 5, 'ਨਵਾਂ ਘਰ ਪੁਰਾਣੇ ਨਾਲੋਂ ਵੱਡਾ ਹੈ।', 'Navaa ghar puraane naaloh vadda hai.', 'The new house is bigger than the old one.'),
    (script_id, para2_id, 1, 'ਪਹਿਲੀ ਰਾਤ ਘਰ ਬਹੁਤ ਖਾਲੀ-ਖਾਲੀ ਲੱਗਾ ਸੀ।', 'Pehli raat ghar bahut khaali-khaali lagga si.', 'The first night the house had felt very empty.'),
    (script_id, para2_id, 2, 'ਹੌਲੀ-ਹੌਲੀ ਅਸੀਂ ਸਾਮਾਨ ਸਹੀ ਥਾਂ ''ਤੇ ਰੱਖਿਆ ਸੀ।', 'Hauli-hauli asi saamaan sahi thaa te rakkhiya si.', 'Slowly we had put the belongings in their right places.'),
    (script_id, para2_id, 3, 'ਸਾਡੇ ਗੁਆਂਢੀ ਬਹੁਤ ਪਿਆਰੇ ਹਨ।', 'Saade guandhi bahut piyaare han.', 'Our neighbours are very lovely.'),
    (script_id, para2_id, 4, 'ਉਹਨਾਂ ਨੇ ਸਾਨੂੰ ਮਿਠਾਈ ਦੇ ਕੇ ਸਵਾਗਤ ਕੀਤਾ ਸੀ।', 'Ohnaa ne saanu mithai de ke swaagat kita si.', 'They had welcomed us by giving us sweets.'),
    (script_id, para2_id, 5, 'ਹੁਣ ਸਾਨੂੰ ਇਹ ਘਰ ਆਪਣਾ-ਆਪਣਾ ਲੱਗਦਾ ਹੈ।', 'Hun saanu ih ghar apna-apna laggda hai.', 'Now this house feels like our own.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਪੈਕਿੰਗ ਵਿੱਚ ਕਿੰਨਾ ਸਮਾਂ ਲੱਗਿਆ? (Packing vich kinna samaa laggiya?)', 'ਦੋ ਦਿਨ (do din)', 'ਪੂਰਾ ਹਫ਼ਤਾ (poora hafta)', 'ਇੱਕ ਮਹੀਨਾ (ik mahina)', 'ਤਿੰਨ ਦਿਨ (tinn din)', 'b', 0),
    (script_id, 'ਟਰੱਕ ਕਦੋਂ ਆਇਆ? (Truck kadon aaiya?)', 'ਸ਼ਾਮ ਨੂੰ (shaam nu)', 'ਸਵੇਰੇ ਸੱਤ ਵਜੇ (savere satt vaje)', 'ਦੁਪਹਿਰ ਨੂੰ (dupehar nu)', 'ਰਾਤ ਨੂੰ (raat nu)', 'b', 1),
    (script_id, 'ਪਹਿਲੀ ਰਾਤ ਘਰ ਕਿਹੋ ਜਿਹਾ ਲੱਗਾ? (Pehli raat ghar kiho jiha lagga?)', 'ਭਰਿਆ ਹੋਇਆ (bhariya hoiya)', 'ਖਾਲੀ-ਖਾਲੀ (khaali-khaali)', 'ਗਰਮ (garam)', 'ਠੰਡਾ (thanda)', 'b', 2),
    (script_id, 'ਗੁਆਂਢੀਆਂ ਨੇ ਕੀ ਦਿੱਤਾ? (Guandhiaa ne ki ditta?)', 'ਫੁੱਲ (phul)', 'ਮਿਠਾਈ (mithai)', 'ਫਲ (phal)', 'ਪਾਣੀ (pani)', 'b', 3);

END $$;

NOTIFY pgrst, 'reload schema';
