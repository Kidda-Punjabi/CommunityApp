-- =============================================================================
-- Kidda — Week 7 (Questions + Adjectives) catch-up seed
-- Run after:
--   supabase/catchup-lesson-segments.sql
--   supabase/catchup-teaching-visuals.sql
--   supabase/catchup-week2-activities.sql
--   supabase/homework-submissions-text.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID;
  v_master_deck_id UUID;
  v_week7_questions_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 7
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 7 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Dedicated Week 7 question-words deck (idempotent)
  SELECT id INTO v_week7_questions_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 7 - Question words'
  LIMIT 1;

  IF v_week7_questions_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 7 - Question words',
      'Core Punjabi question words for Week 7 catch-up.'
    )
    RETURNING id INTO v_week7_questions_deck_id;
  END IF;

  -- Question words on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_7', 'question']::text[]
  FROM (VALUES
    ('who', 'ਕੌਣ', 'kaun'),
    ('what', 'ਕੀ', 'ki'),
    ('where', 'ਕਿੱਥੇ', 'kithhe'),
    ('when', 'ਕਦੋਂ', 'kadon'),
    ('why', 'ਕਿਉਂ', 'kiun'),
    ('which', 'ਕਿਹੜਾ', 'kihda'),
    ('how', 'ਕਿਵੇਂ', 'kiven')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'when' AND f.front_text IN ('when', 'kadon'))
        OR (v.front = 'where' AND f.romanised IN ('kithhe', 'kithe', 'kidhar'))
      )
  );

  -- Adjectives on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_7', 'adjective']::text[]
  FROM (VALUES
    ('big', 'ਵੱਡਾ', 'vadda'),
    ('small', 'ਛੋਟਾ', 'chota'),
    ('old', 'ਪੁਰਾਣਾ', 'purana'),
    ('new', 'ਨਵਾਂ', 'nava'),
    ('good', 'ਚੰਗਾ', 'changa'),
    ('bad', 'ਮਾੜਾ', 'manda'),
    ('beautiful', 'ਸੋਹਣਾ', 'sohna'),
    ('tall', 'ਲੰਬਾ', 'lamba'),
    ('short', 'ਥੁੰਗਾ', 'thunga')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'new' AND (f.front_text ILIKE 'new%' OR f.romanised = 'nava'))
        OR (v.front = 'good' AND (f.front_text ILIKE 'good%' OR f.romanised IN ('changa', 'changaa')))
      )
  );

  -- Populate Week 7 question-words deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT DISTINCT ON (f.front_text)
    v_week7_questions_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'vocab'),
    'Week 7 - Question words',
    ARRAY['week_7', 'question']::text[]
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND f.front_text IN ('who', 'what', 'where', 'when', 'why', 'which', 'how')
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_week7_questions_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 6 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 6 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Wants + Needs"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned how to express wants and needs in Punjabi, and how to combine them with everything you''ve learned so far. This week you''ll start asking much richer questions and describing people and things using adjectives.');

  -- Segment 2 — Two ways to ask questions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Two ways to ask questions',
    'icon_hero', '{"icons":["MessageCircleQuestion"],"label":"Asking questions","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi has two simple ways to ask questions. You can either raise your intonation at the end of a sentence for yes/no questions, or use question words like who, what, where and why to ask for specific information.');

  -- Segment 3 — Question words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Question words',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"User","label":"Who","sublabel":"ਕੌਣ (kaun)","color":"purple"},
        {"icon":"HelpCircle","label":"What","sublabel":"ਕੀ (ki)","color":"teal"},
        {"icon":"MapPin","label":"Where","sublabel":"ਕਿੱਥੇ (kithhe)","color":"green"},
        {"icon":"Clock","label":"When","sublabel":"ਕਦੋਂ (kadon)","color":"amber"},
        {"icon":"MessageCircle","label":"Why","sublabel":"ਕਿਉਂ (kiun)","color":"coral"},
        {"icon":"List","label":"Which","sublabel":"ਕਿਹੜਾ (kihda)","color":"gray"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Question words replace the information you''re asking about. Once you know these six words, you can ask hundreds of different questions.');

  -- Segment 4 — Vocabulary: Question words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 4, 4, 'Vocabulary: Question words',
    'icon_hero', '{"icons":["BookOpen"],"label":"Question words","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_week7_questions_deck_id,
    'Learn these seven question words — they unlock who, what, where, when, why, which and how.'
  ) RETURNING id INTO v_seg;

  -- Segment 5 — Translate: Asking questions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Translate: Asking questions',
    'activity_scene', '{"icons":["Languages"],"caption":"Building questions"}'::jsonb,
    'translate', 'Translate each English question into Punjabi. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Who is speaking?', 'ਕੌਣ ਬੋਲ ਰਿਹਾ ਹੈ?', 'Kaun bol riha hai?'),
    (v_seg, 2, 'Where are you?', 'ਤੁਸੀਂ ਕਿੱਥੇ ਹੋ?', 'Tusi kithhe ho?'),
    (v_seg, 3, 'Why are you laughing?', 'ਤੁਸੀਂ ਕਿਉਂ ਹੱਸਦੇ ਹੋ?', 'Tusi kiun hasde ho?'),
    (v_seg, 4, 'Which book?', 'ਕਿਹੜੀ ਕਿਤਾਬ?', 'Kihdi kitaab?'),
    (v_seg, 5, 'When is the class?', 'ਕਲਾਸ ਕਦੋਂ ਹੈ?', 'Class kadon hai?'),
    (v_seg, 6, 'Where are you going?', 'ਤੁਸੀਂ ਕਿੱਥੇ ਜਾ ਰਹੇ ਹੋ?', 'Tusi kithhe ja rahe ho?'),
    (v_seg, 7, 'Who is coming tomorrow?', 'ਕਲ ਕੌਣ ਆ ਰਿਹਾ ਹੈ?', 'Kal kaun aa riha hai?'),
    (v_seg, 8, 'What are you eating?', 'ਤੁਸੀਂ ਕੀ ਖਾ ਰਹੇ ਹੋ?', 'Tusi ki kha rahe ho?'),
    (v_seg, 9, 'Why are they waiting?', 'ਉਹ ਕਿਉਂ ਉਡੀਕ ਰਹੇ ਹਨ?', 'Oh kiun udeek rahe han?'),
    (v_seg, 10, 'Which house is yours?', 'ਕਿਹੜਾ ਘਰ ਤੁਹਾਡਾ ਹੈ?', 'Kihda ghar tuhada hai?');

  -- Segment 6 — Making negatives
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Making negatives',
    'icon_hero', '{"icons":["CircleOff"],"label":"Saying ''not''","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi negatives are straightforward. Most of the time you simply place nahi before the main verb or verb phrase. Once you know how to build a sentence, making it negative is usually just one extra word.');

  -- Segment 7 — Translate: Negative sentences
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Translate: Negative sentences',
    'activity_scene', '{"icons":["Languages"],"caption":"Using negatives"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi using nahi. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I did not go to work.', 'ਮੈਂ ਕੰਮ ਤੇ ਨਹੀਂ ਗਿਆ', 'Mai kaam te nahi gaya'),
    (v_seg, 2, 'She did not speak.', 'ਉਹ ਨਹੀਂ ਬੋਲੀ', 'Oh nahi boli'),
    (v_seg, 3, 'We did not finish.', 'ਅਸੀਂ ਖ਼ਤਮ ਨਹੀਂ ਕੀਤਾ', 'Asi khatam nahi kita'),
    (v_seg, 4, 'He did not eat breakfast.', 'ਉਹ ਨਾਸ਼ਤਾ ਨਹੀਂ ਖਾਧਾ', 'Oh naashta nahi khadha'),
    (v_seg, 5, 'They did not go to school.', 'ਉਹ ਸਕੂਲ ਨਹੀਂ ਗਏ', 'Oh school nahi gaye'),
    (v_seg, 6, 'I cannot come today.', 'ਮੈਂ ਅੱਜ ਨਹੀਂ ਆ ਸਕਦਾ ਹਾਂ', 'Mai ajj nahi aa sakda haa'),
    (v_seg, 7, 'She is not reading.', 'ਉਹ ਪੜ੍ਹ ਨਹੀਂ ਰਹੀ ਹੈ', 'Oh parh nahi rahi hai'),
    (v_seg, 8, 'We are not waiting.', 'ਅਸੀਂ ਉਡੀਕ ਨਹੀਂ ਰਹੇ ਹਾਂ', 'Asi udeek nahi rahe haa'),
    (v_seg, 9, 'They do not speak Punjabi.', 'ਉਹ ਪੰਜਾਬੀ ਨਹੀਂ ਬੋਲਦੇ ਹਨ', 'Oh Punjabi nahi bolde han'),
    (v_seg, 10, 'You are not late.', 'ਤੁਸੀਂ ਲੇਟ ਨਹੀਂ ਹੋ', 'Tusi late nahi ho');

  -- Segment 8 — Describing with adjectives
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Describing with adjectives',
    'icon_hero', '{"icons":["Palette"],"label":"Adding description","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Adjectives make your Punjabi much more expressive. Instead of saying ''car'', you can say ''new car''. Instead of ''house'', you can say ''big house''.');

  -- Segment 9 — Common adjectives
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Common adjectives',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Maximize2","label":"big","sublabel":"ਵੱਡਾ (vadda)","color":"purple"},
        {"icon":"Minimize2","label":"small","sublabel":"ਛੋਟਾ (chota)","color":"teal"},
        {"icon":"History","label":"old","sublabel":"ਪੁਰਾਣਾ (purana)","color":"amber"},
        {"icon":"Sparkles","label":"new","sublabel":"ਨਵਾਂ (nava)","color":"green"},
        {"icon":"ThumbsUp","label":"good","sublabel":"ਚੰਗਾ (changa)","color":"coral"},
        {"icon":"Heart","label":"beautiful","sublabel":"ਸੋਹਣਾ (sohna)","color":"gray"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Like many Punjabi words, adjectives often agree with the noun they describe. You''ll naturally become familiar with these patterns through practice.');

  -- Segment 10 — Possession + adjectives
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Possession + adjectives',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Car","label":"I have a new car."},
        {"icon":"Home","label":"She has a big house."},
        {"icon":"Flower2","label":"They have a beautiful garden."},
        {"icon":"BookOpen","label":"We have an old book."}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Possession becomes much richer when you combine it with adjectives. This lets you describe the things people own naturally.');

  -- Segment 11 — Translate: Adjectives and possession
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Translate: Adjectives and possession',
    'activity_scene', '{"icons":["Languages"],"caption":"Describing people and things"}'::jsonb,
    'translate', 'Translate each sentence using adjectives and possession (kol / possessive forms). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I have a new car.', 'ਮੇਰੇ ਕੋਲ ਨਵੀਂ ਗੱਡੀ ਹੈ', 'Mere kol navi gaddi hai'),
    (v_seg, 2, 'She has a big house.', 'ਉਸਦੇ ਕੋਲ ਵੱਡਾ ਘਰ ਹੈ', 'Usde kol vadda ghar hai'),
    (v_seg, 3, 'He eats good food.', 'ਉਹ ਚੰਗਾ ਖਾਣਾ ਖਾਂਦਾ ਹੈ', 'Oh changa khana khaanda hai'),
    (v_seg, 4, 'We saw an old building.', 'ਅਸੀਂ ਪੁਰਾਨੀ ਇਮਾਰਤ ਦੇਖੀ', 'Asi purani imarat dekhi'),
    (v_seg, 5, 'They have a beautiful car.', 'ਉਹਨਾਂ ਦੇ ਕੋਲ ਸੋਹਣੀ ਗੱਡੀ ਹੈ', 'Ohna de kol sohni gaddi hai'),
    (v_seg, 6, 'I have a small phone.', 'ਮੇਰੇ ਕੋਲ ਛੋਟਾ ਫ਼ੋਨ ਹੈ', 'Mere kol chota phone hai'),
    (v_seg, 7, 'She owns a new book.', 'ਉਸਦੇ ਕੋਲ ਨਵੀਂ ਕਿਤਾਬ ਹੈ', 'Usde kol navi kitaab hai'),
    (v_seg, 8, 'We bought a good gift.', 'ਅਸੀਂ ਚੰਗਾ ਤੋਹਫ਼ਾ ਖਰੀਦਿਆ', 'Asi changa tohfa khareedya'),
    (v_seg, 9, 'They have a large family.', 'ਉਹਨਾਂ ਦਾ ਵੱਡਾ ਪਰਿਵਾਰ ਹੈ', 'Ohna da vadda parivar hai'),
    (v_seg, 10, 'He has a beautiful garden.', 'ਉਸਦੇ ਕੋਲ ਸੋਹਣਾ ਬਗੀਚਾ ਹੈ', 'Usde kol sohna bagicha hai');

  -- Segment 12 — Mixed conversation practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Mixed conversation practice',
    'activity_scene', '{"icons":["MessagesSquare"],"caption":"Putting everything together"}'::jsonb,
    'translate', 'Translate each sentence combining questions, negatives, adjectives and possession. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Where is your new car?', 'ਤੁਹਾਡੀ ਨਵੀਂ ਗੱਡੀ ਕਿੱਥੇ ਹੈ?', 'Tuhadi navi gaddi kithhe hai?'),
    (v_seg, 2, 'Why are you not coming?', 'ਤੁਸੀਂ ਕਿਉਂ ਨਹੀਂ ਆ ਰਹੇ?', 'Tusi kiun nahi aa rahe?'),
    (v_seg, 3, 'Who has the big house?', 'ਵੱਡਾ ਘਰ ਕਿਸਦੇ ਕੋਲ ਹੈ?', 'Vadda ghar kisde kol hai?'),
    (v_seg, 4, 'Which book do you want?', 'ਤੁਹਾਨੂੰ ਕਿਹੜੀ ਕਿਤਾਬ ਚਾਹੀਦੀ ਹੈ?', 'Tuhaanu kihdi kitaab chahidi hai?'),
    (v_seg, 5, 'We do not have enough time.', 'ਸਾਡੇ ਕੋਲ ਕਾਫ਼ੀ ਸਮਾਂ ਨਹੀਂ ਹੈ', 'Saade kol kaafi samaa nahi hai'),
    (v_seg, 6, 'She has a beautiful family.', 'ਉਸਦਾ ਸੋਹਣਾ ਪਰਿਵਾਰ ਹੈ', 'Usda sohna parivar hai'),
    (v_seg, 7, 'Why is he laughing?', 'ਉਹ ਕਿਉਂ ਹੱਸ ਰਿਹਾ ਹੈ?', 'Oh kiun has riha hai?'),
    (v_seg, 8, 'They are not at home.', 'ਉਹ ਘਰ ਤੇ ਨਹੀਂ ਹਨ', 'Oh ghar te nahi han'),
    (v_seg, 9, 'What are you reading?', 'ਤੁਸੀਂ ਕੀ ਪੜ੍ਹ ਰਹੇ ਹੋ?', 'Tusi ki parh rahe ho?'),
    (v_seg, 10, 'Who is your teacher?', 'ਤੁਹਾਡਾ ਅਧਿਆਪਕ ਕੌਣ ਹੈ?', 'Tuhada adhyaapak kaun hai?');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Ask questions and describe the world around you"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now ask meaningful questions, build negative sentences, and describe people and objects using adjectives and possession.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 7 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 7 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 7 recap quiz to lock in questions, negatives and adjectives.'
  );

  -- Segment 15 — Written homework
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: translate 15 sentences","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Translate all 15 sentences into Punjabi below. Romanised input is fine — your tutor will review your written answers.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Who is speaking?', 'ਕੌਣ ਬੋਲ ਰਿਹਾ ਹੈ?', 'Kaun bol riha hai?'),
    (v_seg, 2, 'Where are you?', 'ਤੁਸੀਂ ਕਿੱਥੇ ਹੋ?', 'Tusi kithhe ho?'),
    (v_seg, 3, 'Why are you laughing?', 'ਤੁਸੀਂ ਕਿਉਂ ਹੱਸਦੇ ਹੋ?', 'Tusi kiun hasde ho?'),
    (v_seg, 4, 'Which book?', 'ਕਿਹੜੀ ਕਿਤਾਬ?', 'Kihdi kitaab?'),
    (v_seg, 5, 'When is the class?', 'ਕਲਾਸ ਕਦੋਂ ਹੈ?', 'Class kadon hai?'),
    (v_seg, 6, 'I did not go to work.', 'ਮੈਂ ਕੰਮ ਤੇ ਨਹੀਂ ਗਿਆ', 'Mai kaam te nahi gaya'),
    (v_seg, 7, 'She did not speak.', 'ਉਹ ਨਹੀਂ ਬੋਲੀ', 'Oh nahi boli'),
    (v_seg, 8, 'We did not finish.', 'ਅਸੀਂ ਖ਼ਤਮ ਨਹੀਂ ਕੀਤਾ', 'Asi khatam nahi kita'),
    (v_seg, 9, 'I have a new car.', 'ਮੇਰੇ ਕੋਲ ਨਵੀਂ ਗੱਡੀ ਹੈ', 'Mere kol navi gaddi hai'),
    (v_seg, 10, 'She has a big house.', 'ਉਸਦੇ ਕੋਲ ਵੱਡਾ ਘਰ ਹੈ', 'Usde kol vadda ghar hai'),
    (v_seg, 11, 'He eats good food.', 'ਉਹ ਚੰਗਾ ਖਾਣਾ ਖਾਂਦਾ ਹੈ', 'Oh changa khana khaanda hai'),
    (v_seg, 12, 'We saw an old building.', 'ਅਸੀਂ ਪੁਰਾਨੀ ਇਮਾਰਤ ਦੇਖੀ', 'Asi purani imarat dekhi'),
    (v_seg, 13, 'They have a beautiful car.', 'ਉਹਨਾਂ ਦੇ ਕੋਲ ਸੋਹਣੀ ਗੱਡੀ ਹੈ', 'Ohna de kol sohni gaddi hai'),
    (v_seg, 14, 'Why are you not coming?', 'ਤੁਸੀਂ ਕਿਉਂ ਨਹੀਂ ਆ ਰਹੇ?', 'Tusi kiun nahi aa rahe?'),
    (v_seg, 15, 'Who has the new book?', 'ਨਵੀਂ ਕਿਤਾਬ ਕਿਸਦੇ ਕੋਲ ਹੈ?', 'Navi kitaab kisde kol hai?');

  RAISE NOTICE 'Week 7 catch-up seed complete for lesson %', v_lesson_id;
  RAISE NOTICE 'Week 7 question words deck: %', v_week7_questions_deck_id;
END $$;
