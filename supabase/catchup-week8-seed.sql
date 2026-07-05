-- =============================================================================
-- Kidda — Week 8 (Past Tense) catch-up seed
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
  v_week8_time_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 8
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 8 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Dedicated Week 8 time-expressions deck (idempotent)
  SELECT id INTO v_week8_time_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 8 - Time expressions'
  LIMIT 1;

  IF v_week8_time_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 8 - Time expressions',
      'Past-tense time words for Week 8 catch-up (yesterday, last week, etc.).'
    )
    RETURNING id INTO v_week8_time_deck_id;
  END IF;

  -- Time expressions on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_8', 'time']::text[]
  FROM (VALUES
    ('yesterday', 'ਕੱਲ੍ਹ', 'kal'),
    ('last week', 'ਪਿਛਲੇ ਹਫ਼ਤੇ', 'pichhle hafte'),
    ('last night', 'ਪਿਛਲੀ ਰਾਤ', 'pichhli raat'),
    ('this morning', 'ਅੱਜ ਸਵੇਰੇ', 'ajj savere'),
    ('afternoon', 'ਦੁਪਹਿਰ', 'duphir'),
    ('evening', 'ਸ਼ਾਮ', 'shaam'),
    ('early', 'ਜਲਦੀ', 'jaldi'),
    ('late', 'ਦੇਰ', 'der')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'yesterday' AND (f.front_text ILIKE 'yester%' OR f.romanised IN ('kal', 'kallh', 'kall')))
        OR (v.front = 'evening' AND (f.front_text ILIKE 'even%' OR f.romanised = 'shaam'))
        OR (v.front = 'this morning' AND f.front_text ILIKE 'this morn%')
      )
  );

  -- Populate Week 8 time deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT DISTINCT ON (f.front_text)
    v_week8_time_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'vocab'),
    'Week 8 - Time expressions',
    ARRAY['week_8', 'time']::text[]
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND f.front_text IN (
      'yesterday', 'last week', 'last night', 'this morning',
      'afternoon', 'evening', 'early', 'late'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_week8_time_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 7 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 7 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Questions + Negatives + Adjectives"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned how to ask meaningful questions, make negative sentences and describe people and objects using adjectives. This week we''ll move everything you''ve learned into the past, allowing you to talk about yesterday, last week and past experiences.');

  -- Segment 2 — Talking about the past
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Talking about the past',
    'icon_hero', '{"icons":["History"],"label":"Looking backwards","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'So far you''ve described what people do, can do and want to do. The next step is describing what already happened. Punjabi has its own past tense patterns which you''ll use with the same vocabulary you''ve already learned.');

  -- Segment 3 — Recognising past tense
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Recognising past tense',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Calendar","label":"Yesterday","sublabel":"He came yesterday.","color":"purple"},
        {"icon":"Clock","label":"Last week","sublabel":"She went home last night.","color":"teal"},
        {"icon":"Sunrise","label":"This morning","sublabel":"We finished the work.","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Past tense is usually recognised by time words like yesterday, last week or this morning. Once the time moves into the past, the verb changes with it.');

  -- Segment 4 — Past tense conjugation table
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Past tense conjugation',
    'conjugation_table',
    '{
      "title": "Simple past — endings by gender (e.g. parhna → read)",
      "columns": ["Pronoun", "Masculine", "Feminine", "Example"],
      "rows": [
        {"Pronoun":"I (mai)","Masculine":"-ia / -aa","Feminine":"-ee / -i","Example":"mai parhia / mai gayi"},
        {"Pronoun":"He (oh)","Masculine":"-ia / -aa","Feminine":"-ee / -i","Example":"oh aaya / oh parhi"},
        {"Pronoun":"We (asi)","Masculine":"-e","Feminine":"-eeaan","Example":"asi mile / asi parhe"},
        {"Pronoun":"They (oh)","Masculine":"-e","Feminine":"-eeaan","Example":"oh aaye / oh parhe"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Many Punjabi past tense verbs still agree with gender and number. You''ll notice familiar masculine and feminine endings appearing again, but now they''re describing completed actions.');

  -- Segment 5 — Time expressions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Time expressions',
    'icon_hero', '{"icons":["Calendar"],"label":"Talking about time","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_week8_time_deck_id,
    'Learn these time expressions — they pair with past tense verbs to say when something happened.'
  ) RETURNING id INTO v_seg;

  -- Segment 6 — Translate: Simple past
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Translate: Simple past',
    'activity_scene', '{"icons":["Languages"],"caption":"Completed actions"}'::jsonb,
    'translate', 'Translate each sentence into Punjabi using the simple past. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'He came yesterday.', 'ਉਹ ਕੱਲ੍ਹ ਆਇਆ', 'Oh kal aaya'),
    (v_seg, 2, 'She went home last night.', 'ਉਹ ਪਿਛਲੀ ਰਾਤ ਘਰ ਗਈ', 'Oh pichhli raat ghar gayi'),
    (v_seg, 3, 'I finished the work.', 'ਮੈਂ ਕੰਮ ਖ਼ਤਮ ਕੀਤਾ', 'Mai kamm khatam kita'),
    (v_seg, 4, 'I ate food this morning.', 'ਮੈਂ ਅੱਜ ਸਵੇਰੇ ਖਾਣਾ ਖਾਧਾ', 'Mai ajj savere khana khadha'),
    (v_seg, 5, 'We met our friend yesterday.', 'ਅਸੀਂ ਕੱਲ੍ਹ ਆਪਣੇ ਦੋਸਤ ਨੂੰ ਮਿਲੇ', 'Asi kal apne dost nu mile'),
    (v_seg, 6, 'They arrived late.', 'ਉਹ ਦੇਰ ਨਾਲ ਪਹੁੰਚੇ', 'Oh der naal pahunche'),
    (v_seg, 7, 'She read the book last week.', 'ਉਸ ਨੇ ਪਿਛਲੇ ਹਫ਼ਤੇ ਕਿਤਾਬ ਪੜ੍ਹੀ', 'Usne pichhle hafte kitaab parhi'),
    (v_seg, 8, 'He bought a new phone.', 'ਉਸ ਨੇ ਨਵਾਂ ਫ਼ੋਨ ਖਰੀਦਿਆ', 'Usne nava phone khareedya'),
    (v_seg, 9, 'You started the class.', 'ਤੁਸੀਂ ਕਲਾਸ ਸ਼ੁਰੂ ਕੀਤੀ', 'Tusi class shuru kiti'),
    (v_seg, 10, 'They watched the film.', 'ਉਹਨਾਂ ਨੇ ਫ਼ਿਲਮ ਦੇਖੀ', 'Ohna ne film dekhi');

  -- Segment 7 — Past continuous
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 7, 7, 'Past continuous',
    'icon_hero', '{"icons":["Clock3"],"label":"What was happening","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Sometimes we don''t describe a finished action—we describe something that was happening. Punjabi builds this using the same continuous tense structure you already know, but with past auxiliary verbs. I was reading — Mai parh reha si. She was working — Oh kaam kar rahi si. They were waiting — Oh intzaar kar rahe si.');

  -- Segment 8 — Translate: Past continuous
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 8, 8, 'Translate: Past continuous',
    'activity_scene', '{"icons":["Languages"],"caption":"Actions in progress"}'::jsonb,
    'translate', 'Translate each sentence using past continuous (reha/rahi/rahe + si). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I was reading.', 'ਮੈਂ ਪੜ੍ਹ ਰਿਹਾ ਸੀ', 'Mai parh reha si'),
    (v_seg, 2, 'She was cooking.', 'ਉਹ ਪਕਾ ਰਹੀ ਸੀ', 'Oh paka rahi si'),
    (v_seg, 3, 'We were walking.', 'ਅਸੀਂ ਤੁਰ ਰਹੇ ਸੀ', 'Asi tur rahe si'),
    (v_seg, 4, 'They were waiting outside.', 'ਉਹ ਬਾਹਰ ਇੰਤਜ਼ਾਰ ਕਰ ਰਹੇ ਸੀ', 'Oh bahar intzaar kar rahe si'),
    (v_seg, 5, 'He was watching TV.', 'ਉਹ ਟੀਵੀ ਵੇਖ ਰਿਹਾ ਸੀ', 'Oh TV vekh reha si'),
    (v_seg, 6, 'I was speaking Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲ ਰਿਹਾ ਸੀ', 'Mai Punjabi bol reha si'),
    (v_seg, 7, 'She was helping her mother.', 'ਉਹ ਆਪਣੀ ਮਾਂ ਦੀ ਮਦਦ ਕਰ ਰਹੀ ਸੀ', 'Oh apni maa di madad kar rahi si'),
    (v_seg, 8, 'We were eating dinner.', 'ਅਸੀਂ ਰਾਤ ਦਾ ਖਾਣਾ ਖਾ ਰਹੇ ਸੀ', 'Asi raat da khana kha rahe si'),
    (v_seg, 9, 'They were studying.', 'ਉਹ ਪੜ੍ਹਾਈ ਕਰ ਰਹੇ ਸੀ', 'Oh padhai kar rahe si'),
    (v_seg, 10, 'You were sleeping.', 'ਤੁਸੀਂ ਸੌ ਰਹੇ ਸੀ', 'Tusi sou rahe si');

  -- Segment 9 — Mixing past and time
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Mixing past and time',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Calendar","label":"Yesterday I…"},
        {"icon":"Clock","label":"Last week we…"},
        {"icon":"Sunrise","label":"This morning she…"},
        {"icon":"Moon","label":"Last night they…"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Time words help listeners immediately understand when something happened. They''re used constantly in everyday conversation.');

  -- Segment 10 — Translate: Mixed past practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 10, 10, 'Translate: Mixed past practice',
    'activity_scene', '{"icons":["Languages"],"caption":"Past tense conversations"}'::jsonb,
    'translate', 'Translate each sentence into Punjabi with time words and past tense. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Yesterday I worked.', 'ਕੱਲ੍ਹ ਮੈਂ ਕੰਮ ਕੀਤਾ', 'Kal mai kaam kita'),
    (v_seg, 2, 'Last night she cooked dinner.', 'ਪਿਛਲੀ ਰਾਤ ਉਸ ਨੇ ਰਾਤ ਦਾ ਖਾਣਾ ਪਕਾਇਆ', 'Pichhli raat usne raat da khana pakaya'),
    (v_seg, 3, 'We visited our friend.', 'ਅਸੀਂ ਆਪਣੇ ਦੋਸਤ ਨੂੰ ਮਿਲੇ', 'Asi apne dost nu mile'),
    (v_seg, 4, 'They bought a new car.', 'ਉਹਨਾਂ ਨੇ ਨਵੀਂ ਗੱਡੀ ਖਰੀਦੀ', 'Ohna ne navi gaddi khareedi'),
    (v_seg, 5, 'He finished the lesson.', 'ਉਸ ਨੇ ਪਾਠ ਖ਼ਤਮ ਕੀਤਾ', 'Usne paath khatam kita'),
    (v_seg, 6, 'I met the teacher.', 'ਮੈਂ ਅਧਿਆਪਕ ਨੂੰ ਮਿਲਿਆ', 'Mai adhyaapak nu milia'),
    (v_seg, 7, 'She drank tea.', 'ਉਸ ਨੇ ਚਾਹ ਪੀਤੀ', 'Usne chah piti'),
    (v_seg, 8, 'We watched a film.', 'ਅਸੀਂ ਫ਼ਿਲਮ ਦੇਖੀ', 'Asi film dekhi'),
    (v_seg, 9, 'They came home late.', 'ਉਹ ਦੇਰ ਨਾਲ ਘਰ ਆਏ', 'Oh der naal ghar aaye'),
    (v_seg, 10, 'You learned Punjabi.', 'ਤੁਸੀਂ ਪੰਜਾਬੀ ਸਿੱਖੀ', 'Tusi Punjabi sikhia');

  -- Segment 11 — Talking about your day
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 11, 11, 'Talking about your day',
    'icon_hero', '{"icons":["SunMoon"],"label":"Daily conversations","accentColor":"coral"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Past tense becomes most useful when talking about your day. By changing only the time expression, you can tell stories about yesterday, last week or your childhood. Yesterday I… In the afternoon I… In the evening I…');

  -- Segment 12 — Conversation builder (fill blank)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Conversation builder',
    'activity_scene', '{"icons":["MessagesSquare"],"caption":"Build your own story"}'::jsonb,
    'fill_blank', 'Complete each sentence with a past-tense verb phrase using vocabulary you know. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਕੱਲ੍ਹ ਮੈਂ ___', 'Kal mai ___', 'Yesterday I ______.', 'ਕੰਮ ਕੀਤਾ', 'kaam kita'),
    (v_seg, 2, 'ਪਿਛਲੀ ਰਾਤ ਮੈਂ ___', 'Pichhli raat mai ___', 'Last night I ______.', 'ਸੌਂ ਗਿਆ', 'sou gaya'),
    (v_seg, 3, 'ਅੱਜ ਸਵੇਰੇ ਮੈਂ ___', 'Ajj savere mai ___', 'This morning I ______.', 'ਨਾਸ਼ਤਾ ਖਾਧਾ', 'naashta khadha'),
    (v_seg, 4, 'ਪਿਛਲੇ ਹਫ਼ਤੇ ਅਸੀਂ ___', 'Pichhle hafte asi ___', 'Last week we ______.', 'ਦੋਸਤ ਨੂੰ ਮਿਲੇ', 'dost nu mile'),
    (v_seg, 5, 'ਸ਼ਾਮ ਨੂੰ ਉਹ ___', 'Shaam nu oh ___', 'In the evening they ______.', 'ਖੇਡੇ', 'khede');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Talk naturally about the past"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now describe completed actions, actions that were in progress, and use time expressions to tell stories about the past.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 8 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 8 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 8 recap quiz to lock in past tense patterns.'
  );

  -- Segment 15 — Written homework
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: translate 10 sentences","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Translate all 10 sentences into Punjabi below. Romanised input is fine — your tutor will review your written answers.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Yesterday I worked.', 'ਕੱਲ੍ਹ ਮੈਂ ਕੰਮ ਕੀਤਾ', 'Kal mai kaam kita'),
    (v_seg, 2, 'She went home last night.', 'ਉਹ ਪਿਛਲੀ ਰਾਤ ਘਰ ਗਈ', 'Oh pichhli raat ghar gayi'),
    (v_seg, 3, 'We finished the lesson.', 'ਅਸੀਂ ਪਾਠ ਖ਼ਤਮ ਕੀਤਾ', 'Asi paath khatam kita'),
    (v_seg, 4, 'He ate breakfast.', 'ਉਸ ਨੇ ਨਾਸ਼ਤਾ ਖਾਧਾ', 'Usne naashta khadha'),
    (v_seg, 5, 'They bought a new phone.', 'ਉਹਨਾਂ ਨੇ ਨਵਾਂ ਫ਼ੋਨ ਖਰੀਦਿਆ', 'Ohna ne nava phone khareedya'),
    (v_seg, 6, 'I met my friend yesterday.', 'ਮੈਂ ਕੱਲ੍ਹ ਆਪਣੇ ਦੋਸਤ ਨੂੰ ਮਿਲਿਆ', 'Mai kal apne dost nu milia'),
    (v_seg, 7, 'She read the book last week.', 'ਉਸ ਨੇ ਪਿਛਲੇ ਹਫ਼ਤੇ ਕਿਤਾਬ ਪੜ੍ਹੀ', 'Usne pichhle hafte kitaab parhi'),
    (v_seg, 8, 'We were waiting outside.', 'ਅਸੀਂ ਬਾਹਰ ਇੰਤਜ਼ਾਰ ਕਰ ਰਹੇ ਸੀ', 'Asi bahar intzaar kar rahe si'),
    (v_seg, 9, 'They were studying yesterday evening.', 'ਉਹ ਕੱਲ੍ਹ ਸ਼ਾਮ ਪੜ੍ਹਾਈ ਕਰ ਰਹੇ ਸੀ', 'Oh kal shaam padhai kar rahe si'),
    (v_seg, 10, 'I watched a film last night.', 'ਮੈਂ ਪਿਛਲੀ ਰਾਤ ਫ਼ਿਲਮ ਦੇਖੀ', 'Mai pichhli raat film dekhi');

  RAISE NOTICE 'Week 8 catch-up seed complete for lesson %', v_lesson_id;
  RAISE NOTICE 'Week 8 time expressions deck: %', v_week8_time_deck_id;
END $$;
