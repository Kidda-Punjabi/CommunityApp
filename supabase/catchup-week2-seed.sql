-- =============================================================================
-- Kidda — Week 2 (Understanding Sentence Structure) catch-up seed
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
  v_seg UUID;
  v_fc UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 2
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 2 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Speaking phrase flashcards (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List'
  FROM (VALUES
    ('I drink water', 'ਮੈਂ ਪਾਣੀ ਪੀਂਦਾ ਹਾਂ', 'Mai paani peenda haa'),
    ('She writes a book', 'ਉਹ ਕਿਤਾਬ ਲਿਖਦੀ ਹੈ', 'Oh kitaab likhdi hai'),
    ('We learn Punjabi', 'ਅਸੀਂ ਪੰਜਾਬੀ ਸਿੱਖਦੇ ਹਾਂ', 'Asi Punjabi sikhde haa'),
    ('You ask a question', 'ਤੁਸੀਂ ਸਵਾਲ ਪੁੱਛਦੇ ਹੋ', 'Tusi savaal puchde ho'),
    ('We hear the news', 'ਅਸੀਂ ਖ਼ਬਰ ਸੁਣਦੇ ਹਾਂ', 'Asi khabar sunde haa'),
    ('We speak Punjabi', 'ਅਸੀਂ ਪੰਜਾਬੀ ਬੋਲਦੇ ਹਾਂ', 'Asi Punjabi bolde haa')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id AND f.front_text = v.front
  );

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 1 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 1 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"6 core phrases"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Let''s quickly recap last week before we build on it. You learned six phrases: are you okay, what''s your name, do you speak Punjabi, how old are you, where are you, and what do you do.');

  -- Segment 2
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Why Punjabi feels backwards',
    'icon_hero', '{"icons":["ArrowLeftRight"],"label":"Subject + Object + Verb","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'English puts the verb in the middle: I eat food. Punjabi puts the verb at the end: Mai khaana khaanda haa — literally ''I food eat''. Once you know the order never changes, you can build almost any sentence.');

  -- Segment 3
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'What is an auxiliary verb',
    'icon_hero', '{"icons":["Puzzle"],"label":"The helper word","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'English can drop the helper word — we just say ''I eat food'', not ''I am eat food''. Punjabi can''t drop it. Haa, hai, or han always sits at the very end and tells you who''s doing the action and when. If a Punjabi sentence feels like it''s missing something, you''ve probably forgotten the auxiliary verb.');

  -- Segment 4 — formula + conjugation table
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'The Punjabi formula',
    'conjugation_table',
    '{
      "title": "Khedna (to play) — verb endings + auxiliary",
      "columns": ["Pronoun", "Masculine", "Feminine", "Example"],
      "rows": [
        {"Pronoun":"I (mai)","Masculine":"khedda","Feminine":"kheddi","Example":"mai khedda haa"},
        {"Pronoun":"He (oh)","Masculine":"khedda","Feminine":"kheddi","Example":"oh khedda hai"},
        {"Pronoun":"We (asi)","Masculine":"khedde","Feminine":"khedde","Example":"asi khedde haa"},
        {"Pronoun":"You (tusi)","Masculine":"khedde","Feminine":"khedde","Example":"tusi khedde ho"},
        {"Pronoun":"They (oh)","Masculine":"khedde","Feminine":"khedde","Example":"oh khedde han"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Here''s the full pattern using ''to play'' (khedna): mai khedda haa (I play), oh khedda hai (he plays) / kheddi hai (she plays), asi khedde haa (we play), tusi khedde ho (you play), oh khedde han (they play). Notice the verb ending changes for gender — da for masculine, di for feminine, de for plural — and the auxiliary changes for person.');

  -- Segment 5 — vocab flashcard_set
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Vocab: everyday verbs',
    'icon_hero', '{"icons":["BookOpen"],"label":"Consonant-root verbs","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_master_deck_id,
    'Review these everyday verbs in the master vocabulary deck. Focus on the verb root and how endings attach.'
  ) RETURNING id INTO v_seg;

  -- Segment 6 — vocab quiz (link quiz in admin if needed)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Vocab quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Quick vocab check"}'::jsonb,
    'quiz', 'Take the quick vocab quiz for this week''s verbs.'
  );

  -- Segment 7 — fill_blank
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Fill the gaps — verb endings',
    'activity_scene', '{"icons":["PenLine"],"caption":"Complete the ending"}'::jsonb,
    'fill_blank', 'Add the correct ending (-da/-di/-de) or full ending + auxiliary to complete each sentence.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਮੈਂ ਖੇਡ___ ਹਾਂ', 'Mai khed___ haa', 'I play', 'ਦਾ', 'da'),
    (v_seg, 2, 'ਉਹ ਲਿਖ___ ਹੈ', 'Oh likh___ hai', 'She writes', 'ਦੀ', 'di'),
    (v_seg, 3, 'ਅਸੀਂ ਬੈਠ___ ਹਾਂ', 'Asi baith___ haa', 'We sit', 'ਦੇ', 'de'),
    (v_seg, 4, 'ਤੁਸੀਂ ਸਿੱਖ___ ਹੋ', 'Tusi sikh___ ho', 'You learn', 'ਦੇ', 'de'),
    (v_seg, 5, 'ਉਹ ਪੜ੍ਹ___ ਹੈ', 'Oh parh___ hai', 'He reads', 'ਦਾ', 'da'),
    (v_seg, 6, 'ਉਹ ਖੇਡ___ ਹਨ', 'Oh khed___ han', 'They play', 'ਦੇ', 'de'),
    (v_seg, 7, 'ਮੈਂ ਸੋਚ___ ਹਾਂ', 'Mai soch___ haa', 'I think', 'ਦਾ', 'da'),
    (v_seg, 8, 'ਤੁਸੀਂ ਰੁਕ___ ਹੋ', 'Tusi ruk___ ho', 'You stop', 'ਦੇ', 'de'),
    (v_seg, 9, 'ਉਹ ਮਦਦ ਕਰ___ ਹੈ', 'Oh madad kar___ hai', 'She helps', 'ਦੀ', 'di'),
    (v_seg, 10, 'He reads', NULL, 'He reads', 'ਪੜ੍ਹਦਾ ਹੈ', 'parhda hai'),
    (v_seg, 11, 'We play', NULL, 'We play', 'ਖੇਡਦੇ ਹਾਂ', 'khedde haa'),
    (v_seg, 12, 'You sit', NULL, 'You sit', 'ਬੈਠਦੇ ਹੋ', 'baithde ho'),
    (v_seg, 13, 'He/She learns', NULL, 'He/She learns', 'ਸਿੱਖਦਾ ਹੈ', 'sikhda hai'),
    (v_seg, 14, 'I think', NULL, 'I think', 'ਸੋਚਦਾ ਹਾਂ', 'sochda haa'),
    (v_seg, 15, 'He/She opens', NULL, 'He/She opens', 'ਖੋਲਦਾ ਹੈ', 'kholda hai'),
    (v_seg, 16, 'You tell', NULL, 'You tell', 'ਦੱਸਦੇ ਹੋ', 'dassde ho'),
    (v_seg, 17, 'They use', NULL, 'They use', 'ਵਰਤਦੇ ਹਨ', 'vartde han'),
    (v_seg, 18, 'I ask', NULL, 'I ask', 'ਪੁੱਛਦਾ ਹਾਂ', 'puchda haa');

  -- Segment 8 — translate
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 8, 8, 'Translate the sentences',
    'activity_scene', '{"icons":["Languages"],"caption":"English to Punjabi"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'They write', 'ਉਹ ਲਿਖਦੇ ਹਨ', 'Oh likhde han'),
    (v_seg, 2, 'We read', 'ਅਸੀਂ ਪੜ੍ਹਦੇ ਹਾਂ', 'Asi parhde haa'),
    (v_seg, 3, 'You open', 'ਤੁਸੀਂ ਖੋਲਦੇ ਹੋ', 'Tusi kholde ho'),
    (v_seg, 4, 'He waits', 'ਉਹ ਉਡੀਕ ਕਰਦਾ ਹੈ', 'Oh udeek karda hai'),
    (v_seg, 5, 'I think', 'ਮੈਂ ਸੋਚਦਾ ਹਾਂ', 'Mai sochda haa'),
    (v_seg, 6, 'I open', 'ਮੈਂ ਖੋਲਦਾ ਹਾਂ', 'Mai kholda haa'),
    (v_seg, 7, 'She closes', 'ਉਹ ਬੰਦ ਕਰਦੀ ਹੈ', 'Oh band kardi hai'),
    (v_seg, 8, 'We help', 'ਅਸੀਂ ਮਦਦ ਕਰਦੇ ਹਾਂ', 'Asi madad karde haa'),
    (v_seg, 9, 'They understand', 'ਉਹ ਸਮਝਦੇ ਹਨ', 'Oh samajhde han'),
    (v_seg, 10, 'You tell', 'ਤੁਸੀਂ ਦੱਸਦੇ ਹੋ', 'Tusi dassde ho'),
    (v_seg, 11, 'You sit', 'ਤੁਸੀਂ ਬੈਠਦੇ ਹੋ', 'Tusi baithde ho'),
    (v_seg, 12, 'We use', 'ਅਸੀਂ ਵਰਤਦੇ ਹਾਂ', 'Asi vartde haa'),
    (v_seg, 13, 'They learn', 'ਉਹ ਸਿੱਖਦੇ ਹਨ', 'Oh sikhde han');

  -- Segment 9 — bonus verbs + record practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 9, 9, 'More verbs + write your own',
    'icon_hero', '{"icons":["Sparkles"],"label":"Bonus verbs","accentColor":"coral"}'::jsonb,
    'record_practice',
    'Pick 5 verbs from what you''ve learned and record yourself saying 5 original Punjabi sentences using them. This is ungraded practice — listen back for rhythm and confidence.'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Here are a few more useful verbs: to remember, to forget, to laugh, to cry, to live, to work, to send, to wake up, and to stand up. Try building your own sentences with them.');

  -- Segment 10 — objects in sentences
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Adding objects into sentences',
    'icon_hero', '{"icons":["Plus"],"label":"Subject + Object + Verb + Aux","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'So far your sentences have had a subject and a verb: mai parhda haa, I read. But most real sentences also have an object — the thing being acted on. Mai kitaab parhda haa — I read a book. Kitaab (book) is the object. Adding objects makes your Punjabi sound natural instead of just correct.');

  -- Segment 11 — speaking practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Say it aloud',
    'activity_scene', '{"icons":["Mic"],"caption":"Repeat for rhythm and clarity"}'::jsonb,
    'game', 'Open Speaking Practice and repeat each sentence for rhythm and clarity.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, source_content_type, source_content_id)
  SELECT v_seg, ROW_NUMBER() OVER (ORDER BY f.front_text), 'phrase_reference', 'flashcard', f.id
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND f.front_text IN (
      'I drink water', 'She writes a book', 'We learn Punjabi',
      'You ask a question', 'We hear the news', 'We speak Punjabi'
    );

  -- Segment 12 — recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Build sentences with the Punjabi formula"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now build sentences using Subject-Object-Verb-Auxiliary order, adjust verb endings for gender (da/di/de), and pick the right auxiliary verb for who''s speaking.');

  -- Segment 13 — recap quiz
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 2 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 2 recap quiz to lock in sentence structure.'
  );

  -- Segment 14 — written homework
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 14, 14, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: translate 10 sentences","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Translate all 10 sentences into Punjabi below. Romanised input is fine — your tutor will review your written answers.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'She eats roti', 'ਉਹ ਰੋਟੀ ਖਾਂਦੀ ਹੈ', 'Oh roti khaandi hai'),
    (v_seg, 2, 'We go to school', 'ਅਸੀਂ ਸਕੂਲ ਜਾਂਦੇ ਹਾਂ', 'Asi school jaande haa'),
    (v_seg, 3, 'They clean the house', 'ਉਹ ਘਰ ਸਾਫ਼ ਕਰਦੇ ਹਨ', 'Oh ghar saaf karde han'),
    (v_seg, 4, 'I read a book', 'ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹਦਾ ਹਾਂ', 'Mai kitaab parhda haa'),
    (v_seg, 5, 'She writes a book', 'ਉਹ ਕਿਤਾਬ ਲਿਖਦੀ ਹੈ', 'Oh kitaab likhdi hai'),
    (v_seg, 6, 'You open the door', 'ਤੁਸੀਂ ਦਰਵਾਜ਼ਾ ਖੋਲ੍ਹਦੇ ਹੋ', 'Tusi darvaza kholde ho'),
    (v_seg, 7, 'I listen to a song', 'ਮੈਂ ਗਾਣਾ ਸੁਣਦਾ ਹਾਂ', 'Mai gaana sunda haa'),
    (v_seg, 8, 'We finish the work', 'ਅਸੀਂ ਕੰਮ ਖ਼ਤਮ ਕਰਦੇ ਹਾਂ', 'Asi kamm khatam karde haa'),
    (v_seg, 9, 'I drive the car', 'ਮੈਂ ਗੱਡੀ ਚਲਾਉਂਦਾ ਹਾਂ', 'Mai gaddi chalaunda haa'),
    (v_seg, 10, 'She washes the clothes', 'ਉਹ ਕੱਪੜੇ ਧੋਂਦੀ ਹੈ', 'Oh kapre dhondi hai');

  RAISE NOTICE 'Week 2 catch-up seed complete for lesson %', v_lesson_id;
END $$;
