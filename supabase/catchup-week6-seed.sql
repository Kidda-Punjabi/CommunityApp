-- =============================================================================
-- Kidda — Week 6 (Wants + Needs) catch-up seed
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
  v_week6_verbs_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 6
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 6 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Dedicated Week 6 verbs deck (idempotent)
  SELECT id INTO v_week6_verbs_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 6 - Wants and needs verbs'
  LIMIT 1;

  IF v_week6_verbs_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 6 - Wants and needs verbs',
      'Essential verb infinitives for expressing wants and needs in Week 6 catch-up.'
    )
    RETURNING id INTO v_week6_verbs_deck_id;
  END IF;

  -- Missing verbs on master deck (create only if absent)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_6', 'verb']::text[]
  FROM (VALUES
    ('to study', 'ਪੜ੍ਹਾਈ ਕਰਨਾ', 'padhai karna'),
    ('to travel', 'ਸਫ਼ਰ ਕਰਨਾ', 'safar karna')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'to study' AND (f.front_text ILIKE 'to stud%' OR f.romanised IN ('padhai karna', 'padhna')))
        OR (v.front = 'to travel' AND (f.front_text ILIKE 'to trav%' OR f.romanised IN ('safar karna', 'safar')))
      )
  );

  -- Populate Week 6 deck from master (link existing verbs only)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT DISTINCT ON (f.front_text)
    v_week6_verbs_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'vocab'),
    'Week 6 - Wants and needs verbs',
    ARRAY['week_6', 'verb']::text[]
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND (
      f.front_text IN (
        'to eat', 'to drink', 'to read', 'to write', 'to study', 'to work',
        'to help', 'to buy', 'to sleep', 'to travel', 'to speak', 'to learn'
      )
      OR f.front_text ILIKE 'to eat%'
      OR f.front_text ILIKE 'to drink%'
      OR f.front_text ILIKE 'to read%'
      OR f.front_text ILIKE 'to write%'
      OR f.front_text ILIKE 'to stud%'
      OR f.front_text ILIKE 'to work%'
      OR f.front_text ILIKE 'to help%'
      OR f.front_text ILIKE 'to buy%'
      OR f.front_text ILIKE 'to sleep%'
      OR f.front_text ILIKE 'to trav%'
      OR f.front_text ILIKE 'to speak%'
      OR f.front_text ILIKE 'to learn%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_week6_verbs_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 5 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 5 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Verbals + Position words"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned that Punjabi verbs can become nouns, allowing you to talk about activities like reading, writing and speaking. You also learned position words to describe where people and objects are. This week you''ll learn how to express what people want and what they need.');

  -- Segment 2 — Want vs Need
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Want vs Need',
    'icon_hero', '{"icons":["Heart","CircleAlert"],"label":"Desire vs Necessity","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'There is an important difference between wanting something and needing something. Want expresses preference or desire. Need expresses necessity. Punjabi uses different sentence structures for each.');

  -- Segment 3 — Expressing wants
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Expressing wants',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Utensils","label":"I want to eat","sublabel":"Mainu khana chahida hai","color":"purple"},
        {"icon":"BookOpen","label":"She wants to learn","sublabel":"Ohnu sikhna chahida hai","color":"teal"},
        {"icon":"Plane","label":"We want to travel","sublabel":"Sanu safar karna chahida hai","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi expresses wants using the structure ''to me… is wanted'' rather than ''I want''. This may feel unusual at first, but it quickly becomes natural.');

  -- Segment 4 — How wants are built
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'How wants are built',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"User","label":"Person + nu"},
        {"icon":"BookOpen","label":"verbal (infinitive)"},
        {"icon":"Heart","label":"chahida / chahidi"},
        {"icon":"Sparkles","label":"I want to eat."},
        {"icon":"Sparkles","label":"She wants to study."},
        {"icon":"Sparkles","label":"We want to go home."}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Notice that the verb remains in its infinitive form. The action itself becomes the thing being wanted.');

  -- Segment 5 — Expressing needs
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 5, 5, 'Expressing needs',
    'icon_hero', '{"icons":["TriangleAlert"],"label":"Talking about necessity","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Needs work in a similar way, but they express something that is required rather than simply desired. Mainu padhna painda hai — I need to study. Sanu jaana painda hai — We need to leave. Ohna nu kaam karna painda hai — They need to work.');

  -- Segment 6 — Vocabulary: wants and needs
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Vocabulary: wants and needs',
    'icon_hero', '{"icons":["BookOpen"],"label":"Essential verbs","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_week6_verbs_deck_id,
    'Review these verb infinitives — they pair with chahida (want) or painda (need) in the structures you just learned.'
  ) RETURNING id INTO v_seg;

  -- Segment 7 — Translate: Wants
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Translate: Wants',
    'activity_scene', '{"icons":["Languages"],"caption":"Talking about wants"}'::jsonb,
    'translate', 'Translate each sentence using the want structure (person + nu + infinitive + chahida). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I want to eat.', 'ਮੈਨੂੰ ਖਾਣਾ ਚਾਹੀਦਾ ਹੈ', 'Mainu khana chahida hai'),
    (v_seg, 2, 'She wants to study.', 'ਉਸਨੂੰ ਪੜ੍ਹਾਈ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ', 'Usnu padhai karni chahidi hai'),
    (v_seg, 3, 'We want to speak Punjabi.', 'ਸਾਨੂੰ ਪੰਜਾਬੀ ਬੋਲਣਾ ਚਾਹੀਦਾ ਹੈ', 'Sanu Punjabi bolna chahida hai'),
    (v_seg, 4, 'They want to travel.', 'ਉਹਨਾਂਨੂੰ ਸਫ਼ਰ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ', 'Uhanaanu safar karna chahida hai'),
    (v_seg, 5, 'You want to help.', 'ਤੁਹਾਨੂੰ ਮਦਦ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ', 'Tuhaanu madad karni chahidi hai'),
    (v_seg, 6, 'I want to buy food.', 'ਮੈਨੂੰ ਖਾਣਾ ਖਰੀਦਣਾ ਚਾਹੀਦਾ ਹੈ', 'Mainu khaana khareedna chahida hai'),
    (v_seg, 7, 'He wants to sleep.', 'ਉਸਨੂੰ ਸੌਣਾ ਚਾਹੀਦਾ ਹੈ', 'Usnu sauna chahida hai'),
    (v_seg, 8, 'She wants to learn Punjabi.', 'ਉਸਨੂੰ ਪੰਜਾਬੀ ਸਿੱਖਣਾ ਚਾਹੀਦਾ ਹੈ', 'Usnu Punjabi sikhna chahida hai'),
    (v_seg, 9, 'We want to read.', 'ਸਾਨੂੰ ਪੜ੍ਹਨਾ ਚਾਹੀਦਾ ਹੈ', 'Sanu parhna chahida hai'),
    (v_seg, 10, 'They want to drink tea.', 'ਉਹਨਾਂਨੂੰ ਚਾਹ ਪੀਣਾ ਚਾਹੀਦਾ ਹੈ', 'Uhanaanu chah peena chahida hai');

  -- Segment 8 — Translate: Needs
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 8, 8, 'Translate: Needs',
    'activity_scene', '{"icons":["Languages"],"caption":"Talking about needs"}'::jsonb,
    'translate', 'Translate each sentence using the need structure (person + nu + infinitive + painda). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I need to work.', 'ਮੈਨੂੰ ਕੰਮ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Mainu kaam karna painda hai'),
    (v_seg, 2, 'She needs to study.', 'ਉਸਨੂੰ ਪੜ੍ਹਾਈ ਕਰਨੀ ਪੈਂਦੀ ਹੈ', 'Usnu padhai karni paindi hai'),
    (v_seg, 3, 'We need to leave.', 'ਸਾਨੂੰ ਜਾਣਾ ਪੈਂਦਾ ਹੈ', 'Sanu jaana painda hai'),
    (v_seg, 4, 'They need to eat.', 'ਉਹਨਾਂਨੂੰ ਖਾਣਾ ਖਾਣਾ ਪੈਂਦਾ ਹੈ', 'Uhanaanu khana khana painda hai'),
    (v_seg, 5, 'You need to help.', 'ਤੁਹਾਨੂੰ ਮਦਦ ਕਰਨੀ ਪੈਂਦੀ ਹੈ', 'Tuhaanu madad karni paindi hai'),
    (v_seg, 6, 'He needs to sleep.', 'ਉਸਨੂੰ ਸੌਣਾ ਪੈਂਦਾ ਹੈ', 'Usnu sauna painda hai'),
    (v_seg, 7, 'I need to practise.', 'ਮੈਨੂੰ ਅਭਿਆਸ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Mainu abhyaas karna painda hai'),
    (v_seg, 8, 'She needs to speak Punjabi.', 'ਉਸਨੂੰ ਪੰਜਾਬੀ ਬੋਲਣਾ ਪੈਂਦਾ ਹੈ', 'Usnu Punjabi bolna painda hai'),
    (v_seg, 9, 'We need to clean the house.', 'ਸਾਨੂੰ ਘਰ ਸਾਫ਼ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Sanu ghar saaf karna painda hai'),
    (v_seg, 10, 'They need to buy food.', 'ਉਹਨਾਂਨੂੰ ਖਾਣਾ ਖਰੀਦਣਾ ਪੈਂਦਾ ਹੈ', 'Uhanaanu khaana khareedna painda hai');

  -- Segment 9 — Want vs Need (comparison)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Want vs Need',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Heart","label":"Want","sublabel":"preference — Mainu parhna chahida hai","color":"purple"},
        {"icon":"TriangleAlert","label":"Need","sublabel":"necessity — Mainu parhna painda hai","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'The action is the same, but the meaning changes completely. I want to read — Mainu parhna chahida hai. I need to read — Mainu parhna painda hai. Choosing the correct structure lets you express how important something really is.');

  -- Segment 10 — Building natural conversations
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Building natural conversations',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Utensils","label":"I want to eat because I''m hungry."},
        {"icon":"BookOpen","label":"She needs to study before class."},
        {"icon":"Heart","label":"We want to help our friends."},
        {"icon":"Clock","label":"They need to leave now."}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Now you can combine wants and needs with everything you''ve already learned—connecting words, verbals and objects.');

  -- Segment 11 — Translate: Mixed practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Translate: Mixed practice',
    'activity_scene', '{"icons":["Languages"],"caption":"Using everything together"}'::jsonb,
    'translate', 'Translate each sentence using wants, needs, and connecting words where needed. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I want to learn Punjabi because my grandparents speak it.', 'ਮੈਨੂੰ ਪੰਜਾਬੀ ਸਿੱਖਣਾ ਚਾਹੀਦਾ ਹੈ ਕਿਉਂਕਿ ਮੇਰੇ ਦਾਦਾ-ਦਾਦੀ ਬੋਲਦੇ ਹਨ', 'Mainu Punjabi sikhna chahida hai kiunki mere dada-dadi bolde han'),
    (v_seg, 2, 'She needs to work tomorrow.', 'ਉਸਨੂੰ ਕਲ ਕੰਮ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Usnu kal kaam karna painda hai'),
    (v_seg, 3, 'We want to eat together.', 'ਸਾਨੂੰ ਇਕੱਠੇ ਖਾਣਾ ਖਾਣਾ ਚਾਹੀਦਾ ਹੈ', 'Sanu ikatthe khaana khana chahida hai'),
    (v_seg, 4, 'They need to finish the work.', 'ਉਹਨਾਂਨੂੰ ਕੰਮ ਖ਼ਤਮ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Uhanaanu kamm khatam karna painda hai'),
    (v_seg, 5, 'You want to help your friend.', 'ਤੁਹਾਨੂੰ ਆਪਣੇ ਦੋਸਤ ਦੀ ਮਦਦ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ', 'Tuhaanu apne dost di madad karni chahidi hai'),
    (v_seg, 6, 'He needs to buy a book.', 'ਉਸਨੂੰ ਕਿਤਾਬ ਖਰੀਦਣੀ ਪੈਂਦੀ ਹੈ', 'Usnu kitaab khareedni paindi hai'),
    (v_seg, 7, 'I want to practise speaking.', 'ਮੈਨੂੰ ਬੋਲਣਾ ਅਭਿਆਸ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ', 'Mainu bolna abhyaas karna chahida hai'),
    (v_seg, 8, 'She wants to watch TV.', 'ਉਸਨੂੰ ਟੀਵੀ ਵੇਖਣਾ ਚਾਹੀਦਾ ਹੈ', 'Usnu TV vekhna chahida hai'),
    (v_seg, 9, 'We need to leave now.', 'ਸਾਨੂੰ ਹੁਣ ਜਾਣਾ ਪੈਂਦਾ ਹੈ', 'Sanu hun jaana painda hai'),
    (v_seg, 10, 'They want to travel next year.', 'ਉਹਨਾਂਨੂੰ ਅਗਲੇ ਸਾਲ ਸਫ਼ਰ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ', 'Uhanaanu agle saal safar karna chahida hai');

  -- Segment 12 — Common mistakes
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Common mistakes',
    'icon_hero', '{"icons":["AlertTriangle"],"label":"Things to remember","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Don''t conjugate the main verb after ''want'' or ''need''. The infinitive stays unchanged. Only the surrounding grammar changes.');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Express wants and necessities"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now express what people want, what they need, and combine those ideas into longer, more natural Punjabi sentences.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 6 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 6 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 6 recap quiz to lock in wants and needs.'
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
    (v_seg, 1, 'I want to eat.', 'ਮੈਨੂੰ ਖਾਣਾ ਚਾਹੀਦਾ ਹੈ', 'Mainu khana chahida hai'),
    (v_seg, 2, 'She needs to study.', 'ਉਸਨੂੰ ਪੜ੍ਹਾਈ ਕਰਨੀ ਪੈਂਦੀ ਹੈ', 'Usnu padhai karni paindi hai'),
    (v_seg, 3, 'We want to speak Punjabi.', 'ਸਾਨੂੰ ਪੰਜਾਬੀ ਬੋਲਣਾ ਚਾਹੀਦਾ ਹੈ', 'Sanu Punjabi bolna chahida hai'),
    (v_seg, 4, 'They need to work tomorrow.', 'ਉਹਨਾਂਨੂੰ ਕਲ ਕੰਮ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Uhanaanu kal kaam karna painda hai'),
    (v_seg, 5, 'I want to help my family.', 'ਮੈਨੂੰ ਆਪਣੇ ਪਰਿਵਾਰ ਦੀ ਮਦਦ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ', 'Mainu apne parivar di madad karni chahidi hai'),
    (v_seg, 6, 'He needs to buy food.', 'ਉਸਨੂੰ ਖਾਣਾ ਖਰੀਦਣਾ ਪੈਂਦਾ ਹੈ', 'Usnu khaana khareedna painda hai'),
    (v_seg, 7, 'She wants to learn Punjabi.', 'ਉਸਨੂੰ ਪੰਜਾਬੀ ਸਿੱਖਣਾ ਚਾਹੀਦਾ ਹੈ', 'Usnu Punjabi sikhna chahida hai'),
    (v_seg, 8, 'We need to leave now.', 'ਸਾਨੂੰ ਹੁਣ ਜਾਣਾ ਪੈਂਦਾ ਹੈ', 'Sanu hun jaana painda hai'),
    (v_seg, 9, 'They want to travel together.', 'ਉਹਨਾਂਨੂੰ ਇਕੱਠੇ ਸਫ਼ਰ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ', 'Uhanaanu ikatthe safar karna chahida hai'),
    (v_seg, 10, 'You need to practise every day.', 'ਤੁਹਾਨੂੰ ਹਰ ਦਿਨ ਅਭਿਆਸ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Tuhaanu har din abhyaas karna painda hai');

  RAISE NOTICE 'Week 6 catch-up seed complete for lesson %', v_lesson_id;
  RAISE NOTICE 'Week 6 verbs deck: %', v_week6_verbs_deck_id;
END $$;
