-- =============================================================================
-- Kidda — Week 5 (Verbals + Position Words) catch-up seed
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
  v_week5_verbals_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 5
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 5 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Dedicated Week 5 verbals deck (idempotent)
  SELECT id INTO v_week5_verbals_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 5 - Verbals'
  LIMIT 1;

  IF v_week5_verbals_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 5 - Verbals',
      'Infinitive verb forms used as noun-like verbals in Week 5 catch-up.'
    )
    RETURNING id INTO v_week5_verbals_deck_id;
  END IF;

  -- Position words on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_5', 'position']::text[]
  FROM (VALUES
    ('in front of', 'ਦੇ ਸਾਹਮਣੇ', 'de saahmne'),
    ('behind', 'ਦੇ ਪਿਛੇ', 'de pichhe'),
    ('beside', 'ਦੇ ਕਿਨਾਰੇ', 'de kinare'),
    ('between', 'ਦੇ ਵਿਚਕਾਰ', 'de vichkar'),
    ('inside', 'ਅੰਦਰ', 'andar'),
    ('outside', 'ਬਾਹਰ', 'bahar'),
    ('above', 'ਉੱਪਰ', 'uppar'),
    ('below', 'ਥੱਲੇ', 'thalle')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'in front of' AND (f.front_text ILIKE 'in front%' OR f.romanised IN ('de saahmne', 'saahmne', 'agge')))
        OR (v.front = 'behind' AND (f.front_text ILIKE 'behind%' OR f.romanised IN ('de pichhe', 'pichhe')))
        OR (v.front = 'beside' AND (f.front_text ILIKE 'beside%' OR f.romanised IN ('de kinare', 'kinare')))
        OR (v.front = 'between' AND (f.front_text ILIKE 'between%' OR f.romanised IN ('de vichkar', 'vichkar')))
        OR (v.front = 'inside' AND (f.front_text ILIKE 'inside%' OR f.romanised = 'andar'))
        OR (v.front = 'outside' AND (f.front_text ILIKE 'outside%' OR f.romanised = 'bahar'))
        OR (v.front = 'above' AND (f.front_text ILIKE 'above%' OR f.romanised = 'uppar'))
        OR (v.front = 'below' AND (f.front_text ILIKE 'below%' OR f.romanised IN ('thalle', 'thalle')))
      )
  );

  -- Populate Week 5 verbals deck from master (link existing verbs only)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT DISTINCT ON (f.front_text)
    v_week5_verbals_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'vocab'),
    'Week 5 - Verbals',
    ARRAY['week_5', 'verbal']::text[]
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND (
      f.front_text IN (
        'to read', 'to write', 'to speak', 'to eat', 'to watch',
        'to learn', 'to play', 'to sit', 'to walk'
      )
      OR f.front_text ILIKE 'to practi%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_week5_verbals_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 4 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 4 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Ability + Connecting sentences"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned how to talk about what someone can do using sakna, how to join ideas together with connecting words, and how to build more natural sentences using objects. This week you''ll learn a new way of using verbs—as nouns.');

  -- Segment 2 — What is a verbal?
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'What is a verbal?',
    'icon_hero', '{"icons":["BookOpen"],"label":"Verbs becoming nouns","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Sometimes we don''t want to talk about doing an action—we want to talk about the action itself. English does this with words like ''reading'', ''writing'' or ''speaking''. Punjabi does the same using the infinitive form of the verb.');

  -- Segment 3 — Recognising verbals
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Recognising verbals',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"BookOpen","label":"Reading","sublabel":"Reading is fun.","color":"purple"},
        {"icon":"PenLine","label":"Writing","sublabel":"I like writing.","color":"teal"},
        {"icon":"MessageCircle","label":"Speaking","sublabel":"Speaking Punjabi is useful.","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'A verbal behaves like a noun. Instead of describing what someone is doing, it becomes the thing you''re talking about.');

  -- Segment 4 — Verb vs verbal
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Verb vs verbal',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"BookOpen","label":"I read a book."},
        {"icon":"Sparkles","label":"Reading is enjoyable."},
        {"icon":"MessageCircle","label":"She speaks Punjabi."},
        {"icon":"Check","label":"Speaking Punjabi is useful."}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Notice the difference. In the first sentence the verb describes an action. In the second, the whole action becomes the subject of the sentence.');

  -- Segment 5 — Common verbal patterns
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 5, 5, 'Common verbal patterns',
    'icon_hero', '{"icons":["Table"],"label":"Using verbals","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi commonly uses verbals after verbs like ''like'', ''love'', ''start'', ''finish'', ''practise'' and ''want''. The verb itself stays in its dictionary form. Like reading. Start writing. Practise speaking. Enjoy watching.');

  -- Segment 6 — Vocabulary: common verbals
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Vocabulary: common verbals',
    'icon_hero', '{"icons":["BookOpen"],"label":"Verbals","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_week5_verbals_deck_id,
    'Review these verb infinitives. Notice the -na ending — that dictionary form is what you use as a verbal.'
  ) RETURNING id INTO v_seg;

  -- Segment 7 — Translate: Verbals
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Translate: Verbals',
    'activity_scene', '{"icons":["Languages"],"caption":"Using verbals"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi using verbals (infinitive forms). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I like reading.', 'ਮੈਂ ਪੜ੍ਹਨਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai parhna pasand karda haa'),
    (v_seg, 2, 'She starts writing.', 'ਉਹ ਲਿਖਣਾ ਸ਼ੁਰੂ ਕਰਦੀ ਹੈ', 'Oh likhna shuru kardi hai'),
    (v_seg, 3, 'We practise speaking Punjabi.', 'ਅਸੀਂ ਪੰਜਾਬੀ ਬੋਲਣਾ ਅਭਿਆਸ ਕਰਦੇ ਹਾਂ', 'Asi Punjabi bolna abhyaas karde haa'),
    (v_seg, 4, 'They love watching TV.', 'ਉਹ ਟੀਵੀ ਵੇਖਣਾ ਬਹੁਤ ਪਸੰਦ ਕਰਦੇ ਹਨ', 'Oh TV vekhna bahut pasand karde han'),
    (v_seg, 5, 'He enjoys eating food.', 'ਉਹ ਖਾਣਾ ਖਾਣਾ ਪਸੰਦ ਕਰਦਾ ਹੈ', 'Oh khaana khana pasand karda hai'),
    (v_seg, 6, 'I like learning Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖਣਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai Punjabi sikhna pasand karda haa'),
    (v_seg, 7, 'She likes sitting outside.', 'ਉਹ ਬਾਹਰ ਬੈਠਣਾ ਪਸੰਦ ਕਰਦੀ ਹੈ', 'Oh bahar baithna pasand kardi hai'),
    (v_seg, 8, 'We enjoy walking together.', 'ਅਸੀਂ ਇਕੱਠੇ ਤੁਰਨਾ ਪਸੰਦ ਕਰਦੇ ਹਾਂ', 'Asi ikatthe turna pasand karde haa'),
    (v_seg, 9, 'They practise writing Punjabi.', 'ਉਹ ਪੰਜਾਬੀ ਲਿਖਣਾ ਅਭਿਆਸ ਕਰਦੇ ਹਨ', 'Oh Punjabi likhna abhyaas karde han'),
    (v_seg, 10, 'I love speaking Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲਣਾ ਬਹੁਤ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai Punjabi bolna bahut pasand karda haa');

  -- Segment 8 — Position words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Position words',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"ArrowUp","label":"in front of","sublabel":"ਦੇ ਸਾਹਮਣੇ","color":"purple"},
        {"icon":"ArrowDown","label":"behind","sublabel":"ਦੇ ਪਿਛੇ","color":"teal"},
        {"icon":"MoveHorizontal","label":"beside","sublabel":"ਦੇ ਕਿਨਾਰੇ","color":"green"},
        {"icon":"GitCommitHorizontal","label":"between","sublabel":"ਦੇ ਵਿਚਕਾਰ","color":"amber"},
        {"icon":"Box","label":"inside","sublabel":"ਅੰਦਰ","color":"coral"},
        {"icon":"DoorOpen","label":"outside","sublabel":"ਬਾਹਰ","color":"gray"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Position words describe where something is. Instead of talking about actions, we''re now describing locations.');

  -- Segment 9 — Describing locations
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Describing locations',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Home","label":"beside the house"},
        {"icon":"DoorOpen","label":"inside the room"},
        {"icon":"Car","label":"behind the car"},
        {"icon":"Armchair","label":"between two chairs"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Position words normally come before the place or object they describe.');

  -- Segment 10 — Translate: Position words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 10, 10, 'Translate: Position words',
    'activity_scene', '{"icons":["Languages"],"caption":"Describing locations"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi using position words. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'The book is on the table.', 'ਕਿਤਾਬ ਮੇਜ਼ ਤੇ ਹੈ', 'Kitaab mez te hai'),
    (v_seg, 2, 'The car is outside.', 'ਗੱਡੀ ਬਾਹਰ ਹੈ', 'Gaddi bahar hai'),
    (v_seg, 3, 'The dog is behind the house.', 'ਕੁੱਤਾ ਘਰ ਦੇ ਪਿਛੇ ਹੈ', 'Kutta ghar de pichhe hai'),
    (v_seg, 4, 'The teacher is inside the classroom.', 'ਅਧਿਆਪਕ ਕਲਾਸਰੂਮ ਅੰਦਰ ਹੈ', 'Adhyaapak classroom andar hai'),
    (v_seg, 5, 'The chair is beside the table.', 'ਕੁਰਸੀ ਮੇਜ਼ ਦੇ ਕਿਨਾਰੇ ਹੈ', 'Kursi mez de kinare hai'),
    (v_seg, 6, 'The shop is opposite the school.', 'ਦੁਕਾਨ ਸਕੂਲ ਦੇ ਸਾਹਮਣੇ ਹੈ', 'Dukaan school de saahmne hai'),
    (v_seg, 7, 'The phone is in the bag.', 'ਫ਼ੋਨ ਬੈਗ ਵਿਚ ਹੈ', 'Phone bag vich hai'),
    (v_seg, 8, 'The cat is under the chair.', 'ਬਿੱਲੀ ਕੁਰਸੀ ਥੱਲੇ ਹੈ', 'Billi kursi thalle hai'),
    (v_seg, 9, 'The picture is above the sofa.', 'ਤਸਵੀਰ ਸੋਫ਼ੇ ਉੱਪਰ ਹੈ', 'Tasveer sofe uppar hai'),
    (v_seg, 10, 'The children are between the trees.', 'ਬੱਚੇ ਰੁੱਖਾਂ ਦੇ ਵਿਚਕਾਰ ਹਨ', 'Bacche rukhaan de vichkar han');

  -- Segment 11 — Combining verbals and position
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 11, 11, 'Combining verbals and position',
    'icon_hero', '{"icons":["Combine"],"label":"Putting everything together","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Now you can combine both ideas into more natural sentences. I like sitting outside. She enjoys reading in the garden. They practise speaking at school.');

  -- Segment 12 — Translate: Mixed sentences
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Translate: Mixed sentences',
    'activity_scene', '{"icons":["Languages"],"caption":"Putting it all together"}'::jsonb,
    'translate', 'Translate each sentence using verbals and position words together. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I like reading outside.', 'ਮੈਂ ਬਾਹਰ ਪੜ੍ਹਨਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai bahar parhna pasand karda haa'),
    (v_seg, 2, 'She starts writing at home.', 'ਉਹ ਘਰ ਤੇ ਲਿਖਣਾ ਸ਼ੁਰੂ ਕਰਦੀ ਹੈ', 'Oh ghar te likhna shuru kardi hai'),
    (v_seg, 3, 'We practise speaking together.', 'ਅਸੀਂ ਇਕੱਠੇ ਬੋਲਣਾ ਅਭਿਆਸ ਕਰਦੇ ਹਾਂ', 'Asi ikatthe bolna abhyaas karde haa'),
    (v_seg, 4, 'They enjoy sitting in the garden.', 'ਉਹ ਬਗੀਚੇ ਵਿਚ ਬੈਠਣਾ ਪਸੰਦ ਕਰਦੇ ਹਨ', 'Oh bagiche vich baithna pasand karde han'),
    (v_seg, 5, 'He likes watching TV.', 'ਉਹ ਟੀਵੀ ਵੇਖਣਾ ਪਸੰਦ ਕਰਦਾ ਹੈ', 'Oh TV vekhna pasand karda hai'),
    (v_seg, 6, 'I enjoy learning Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖਣਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai Punjabi sikhna pasand karda haa'),
    (v_seg, 7, 'She practises writing every day.', 'ਉਹ ਹਰ ਦਿਨ ਲਿਖਣਾ ਅਭਿਆਸ ਕਰਦੀ ਹੈ', 'Oh har din likhna abhyaas kardi hai'),
    (v_seg, 8, 'We love eating together.', 'ਅਸੀਂ ਇਕੱਠੇ ਖਾਣਾ ਖਾਣਾ ਪਸੰਦ ਕਰਦੇ ਹਾਂ', 'Asi ikatthe khaana khana pasand karde haa'),
    (v_seg, 9, 'They enjoy playing outside.', 'ਉਹ ਬਾਹਰ ਖੇਡਣਾ ਪਸੰਦ ਕਰਦੇ ਹਨ', 'Oh bahar khedna pasand karde han'),
    (v_seg, 10, 'I like sitting beside my friend.', 'ਮੈਂ ਆਪਣੇ ਦੋਸਤ ਦੇ ਕਿਨਾਰੇ ਬੈਠਣਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai apne dost de kinare baithna pasand karda haa');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Use verbals and describe locations"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now use verbs as nouns, describe activities naturally, and explain where people or objects are using position words.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 5 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 5 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 5 recap quiz to lock in verbals and position words.'
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
    (v_seg, 1, 'I like writing.', 'ਮੈਂ ਲਿਖਣਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai likhna pasand karda haa'),
    (v_seg, 2, 'She starts reading.', 'ਉਹ ਪੜ੍ਹਨਾ ਸ਼ੁਰੂ ਕਰਦੀ ਹੈ', 'Oh parhna shuru kardi hai'),
    (v_seg, 3, 'We practise speaking Punjabi.', 'ਅਸੀਂ ਪੰਜਾਬੀ ਬੋਲਣਾ ਅਭਿਆਸ ਕਰਦੇ ਹਾਂ', 'Asi Punjabi bolna abhyaas karde haa'),
    (v_seg, 4, 'They love watching TV in the evening.', 'ਉਹ ਸ਼ਾਮ ਨੂੰ ਟੀਵੀ ਵੇਖਣਾ ਬਹੁਤ ਪਸੰਦ ਕਰਦੇ ਹਨ', 'Oh shaam nu TV vekhna bahut pasand karde han'),
    (v_seg, 5, 'She plays with the cat.', 'ਉਹ ਬਿੱਲੀ ਨਾਲ ਖੇਡਦੀ ਹੈ', 'Oh billi naal kheddi hai'),
    (v_seg, 6, 'I sit with the family.', 'ਮੈਂ ਪਰਿਵਾਰ ਨਾਲ ਬੈਠਦਾ ਹਾਂ', 'Mai parivar naal baithda haa'),
    (v_seg, 7, 'He writes to the friend.', 'ਉਹ ਦੋਸਤ ਨੂੰ ਲਿਖਦਾ ਹੈ', 'Oh dost nu likhda hai'),
    (v_seg, 8, 'She learns from the books.', 'ਉਹ ਕਿਤਾਬਾਂ ਤੋਂ ਸਿੱਖਦੀ ਹੈ', 'Oh kitaabaa ton sikhdi hai'),
    (v_seg, 9, 'We enjoy speaking together.', 'ਅਸੀਂ ਇਕੱਠੇ ਬੋਲਣਾ ਪਸੰਦ ਕਰਦੇ ਹਾਂ', 'Asi ikatthe bolna pasand karde haa'),
    (v_seg, 10, 'They like sitting outside.', 'ਉਹ ਬਾਹਰ ਬੈਠਣਾ ਪਸੰਦ ਕਰਦੇ ਹਨ', 'Oh bahar baithna pasand karde han');

  RAISE NOTICE 'Week 5 catch-up seed complete for lesson %', v_lesson_id;
  RAISE NOTICE 'Week 5 verbals deck: %', v_week5_verbals_deck_id;
END $$;
