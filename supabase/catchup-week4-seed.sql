-- =============================================================================
-- Kidda — Week 4 (Ability + Connecting Sentences) catch-up seed
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
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 4
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 4 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Connecting words on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_4', 'connector']::text[]
  FROM (VALUES
    ('and', 'ਅਤੇ', 'ate'),
    ('but', 'ਪਰ', 'par'),
    ('because', 'ਕਿਉਂਕਿ', 'kiunki'),
    ('when', 'ਜਦੋਂ', 'jadon')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'and' AND f.front_text ILIKE 'and%')
        OR (v.front = 'but' AND f.front_text ILIKE 'but%')
        OR (v.front = 'because' AND (f.front_text ILIKE 'because%' OR f.romanised IN ('kiunki', 'kyunki')))
        OR (v.front = 'when' AND f.front_text ILIKE 'when%')
      )
  );

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 3 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 3 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Verb roots + Continuous tense"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned how Punjabi verbs change depending on their verb root, and how to build both simple present and continuous ''-ing'' sentences. This week you''ll use those same verbs to talk about what people can do, then start joining ideas together into longer, more natural sentences.');

  -- Segment 2 — What does 'can' mean?
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'What does ''can'' mean?',
    'icon_hero', '{"icons":["Sparkles"],"label":"Talking about ability","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'English uses the word ''can'' to talk about ability. Punjabi does exactly the same thing, but instead of a separate word like ''can'', it uses the helping verb sakna. Once you understand sakna, you can say someone can read, write, help, eat, speak or do almost anything.');

  -- Segment 3 — Four uses of sakna
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Four uses of sakna',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"MessageCircle","label":"Skills","sublabel":"I can speak Punjabi","color":"purple"},
        {"icon":"Calendar","label":"Availability","sublabel":"I can come tomorrow","color":"teal"},
        {"icon":"BadgeCheck","label":"Permission","sublabel":"You can start now","color":"green"},
        {"icon":"HelpingHand","label":"Helping","sublabel":"Can you help me?","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi uses the same grammar for several ideas: ability, availability, permission and offering help. Once you know sakna, you can express all four naturally.');

  -- Segment 4 — Understanding sakna
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Understanding sakna',
    'icon_hero', '{"icons":["Scissors"],"label":"sakna = sak + na","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Like every Punjabi verb, sakna has two parts. The root is sak, meaning ''be able'', while na simply marks the dictionary form. During conjugation the na disappears and only the root changes.');

  -- Segment 5 — Building an ability sentence
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 5, 5, 'Building an ability sentence',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"User","label":"Subject"},
        {"icon":"Scissors","label":"Verb root"},
        {"icon":"Sparkles","label":"sakda / sakdi / sakde"},
        {"icon":"Check","label":"Auxiliary verb"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'The sentence formula becomes: Subject + Verb Root + sakda/sakdi/sakde + auxiliary verb. The original verb never changes. Only sakna is conjugated. Mai Punjabi bol sakda haa — I can speak Punjabi.');

  -- Segment 6 — Ability conjugation table
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Ability conjugation table',
    'conjugation_table',
    '{
      "title": "Sakna (can) — endings + auxiliary (example: parh sakda haa)",
      "columns": ["Pronoun", "Masculine", "Feminine", "Example"],
      "rows": [
        {"Pronoun":"I (mai)","Masculine":"sakda","Feminine":"sakdi","Example":"mai parh sakda haa"},
        {"Pronoun":"He (oh)","Masculine":"sakda","Feminine":"sakdi","Example":"oh parh sakda hai"},
        {"Pronoun":"We (asi)","Masculine":"sakde","Feminine":"sakde","Example":"asi parh sakde haa"},
        {"Pronoun":"You (tusi)","Masculine":"sakde","Feminine":"sakde","Example":"tusi parh sakde ho"},
        {"Pronoun":"They (oh)","Masculine":"sakde","Feminine":"sakde","Example":"oh parh sakde han"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Just like ordinary verbs, sakna changes for gender and number. Masculine uses sakda, feminine uses sakdi and plural uses sakde. The auxiliary verbs stay exactly the same as before.');

  -- Segment 7 — Translate: Ability sentences
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Translate: Ability sentences',
    'activity_scene', '{"icons":["Languages"],"caption":"Using sakna"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi using sakna. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I can read', 'ਮੈਂ ਪੜ੍ਹ ਸਕਦਾ ਹਾਂ', 'Mai parh sakda haa'),
    (v_seg, 2, 'She can write', 'ਉਹ ਲਿਖ ਸਕਦੀ ਹੈ', 'Oh likh sakdi hai'),
    (v_seg, 3, 'We can go', 'ਅਸੀਂ ਜਾ ਸਕਦੇ ਹਾਂ', 'Asi ja sakde haa'),
    (v_seg, 4, 'You can sit', 'ਤੁਸੀਂ ਬੈਠ ਸਕਦੇ ਹੋ', 'Tusi baith sakde ho'),
    (v_seg, 5, 'They can come', 'ਉਹ ਆ ਸਕਦੇ ਹਨ', 'Oh aa sakde han'),
    (v_seg, 6, 'I can eat', 'ਮੈਂ ਖਾ ਸਕਦਾ ਹਾਂ', 'Mai kha sakda haa'),
    (v_seg, 7, 'He can drink', 'ਉਹ ਪੀ ਸਕਦਾ ਹੈ', 'Oh pee sakda hai'),
    (v_seg, 8, 'You can listen', 'ਤੁਸੀਂ ਸੁਣ ਸਕਦੇ ਹੋ', 'Tusi sun sakde ho'),
    (v_seg, 9, 'I can walk', 'ਮੈਂ ਤੁਰ ਸਕਦਾ ਹਾਂ', 'Mai tur sakda haa'),
    (v_seg, 10, 'He can run', 'ਉਹ ਦੌੜ ਸਕਦਾ ਹੈ', 'Oh daur sakda hai'),
    (v_seg, 11, 'We can help', 'ਅਸੀਂ ਮਦਦ ਕਰ ਸਕਦੇ ਹਾਂ', 'Asi madad kar sakde haa'),
    (v_seg, 12, 'They can speak Punjabi', 'ਉਹ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹਨ', 'Oh Punjabi bol sakde han'),
    (v_seg, 13, 'She can cook food', 'ਉਹ ਖਾਣਾ ਪਕਾ ਸਕਦੀ ਹੈ', 'Oh khaana paka sakdi hai'),
    (v_seg, 14, 'I can serve food', 'ਮੈਂ ਖਾਣਾ ਪਰੋਸ ਸਕਦਾ ਹਾਂ', 'Mai khaana paros sakda haa'),
    (v_seg, 15, 'We can work', 'ਅਸੀਂ ਕੰਮ ਕਰ ਸਕਦੇ ਹਾਂ', 'Asi kaam kar sakde haa');

  -- Segment 8 — Connecting words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Connecting words',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Plus","label":"and","sublabel":"ਅਤੇ (ate)","color":"purple"},
        {"icon":"Minus","label":"but","sublabel":"ਪਰ (par)","color":"teal"},
        {"icon":"HelpCircle","label":"because","sublabel":"ਕਿਉਂਕਿ (kiunki)","color":"green"},
        {"icon":"Clock","label":"when","sublabel":"ਜਦੋਂ (jadon)","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Once you can build one sentence, connecting words let you combine two ideas together. This makes your Punjabi sound much more natural.');

  -- Segment 9 — Joining two ideas together
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Joining two ideas together',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"BookOpen","label":"I read and I write"},
        {"icon":"Utensils","label":"He cooks because he is hungry"},
        {"icon":"Sun","label":"They play when it is sunny"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Each side of the connecting word is simply another complete Punjabi sentence. You don''t need a new grammar rule—just build two sentences and join them.');

  -- Segment 10 — Translate: Connected sentences
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 10, 10, 'Translate: Connected sentences',
    'activity_scene', '{"icons":["Languages"],"caption":"Building longer sentences"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi, using connecting words where needed. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I can listen and I can speak.', 'ਮੈਂ ਸੁਣ ਸਕਦਾ ਹਾਂ ਅਤੇ ਮੈਂ ਬੋਲ ਸਕਦਾ ਹਾਂ', 'Mai sun sakda haa ate mai bol sakda haa'),
    (v_seg, 2, 'They play outside when she goes.', 'ਉਹ ਬਾਹਰ ਖੇਡਦੇ ਹਨ ਜਦੋਂ ਉਹ ਜਾਂਦੀ ਹੈ', 'Oh bahar khedde han jadon oh jaandi hai'),
    (v_seg, 3, 'You ask questions because you are smart.', 'ਤੁਸੀਂ ਸਵਾਲ ਪੁੱਛਦੇ ਹੋ ਕਿਉਂਕਿ ਤੁਸੀਂ ਹੋਸ਼ਿਆਰ ਹੋ', 'Tusi savaal puchde ho kiunki tusi hoshiyaar ho'),
    (v_seg, 4, 'She cooks food and she can serve food.', 'ਉਹ ਖਾਣਾ ਪਕਾਉਂਦੀ ਹੈ ਅਤੇ ਉਹ ਖਾਣਾ ਪਰੋਸ ਸਕਦੀ ਹੈ', 'Oh khaana pakaundi hai ate oh khaana paros sakdi hai'),
    (v_seg, 5, 'I walk and I go home.', 'ਮੈਂ ਤੁਰਦਾ ਹਾਂ ਅਤੇ ਮੈਂ ਘਰ ਜਾਂਦਾ ਹਾਂ', 'Mai turda haa ate mai ghar jaanda haa'),
    (v_seg, 6, 'We stay home when she works.', 'ਅਸੀਂ ਘਰ ਰਹਿੰਦੇ ਹਾਂ ਜਦੋਂ ਉਹ ਕੰਮ ਕਰਦੀ ਹੈ', 'Asi ghar rehnde haa jadon oh kaam kardi hai'),
    (v_seg, 7, 'He reads because he likes books.', 'ਉਹ ਪੜ੍ਹਦਾ ਹੈ ਕਿਉਂਕਿ ਉਹ ਕਿਤਾਬਾਂ ਪਸੰਦ ਕਰਦਾ ਹੈ', 'Oh parhda hai kiunki oh kitaabaa pasand karda hai'),
    (v_seg, 8, 'They eat and they drink tea.', 'ਉਹ ਖਾਂਦੇ ਹਨ ਅਤੇ ਉਹ ਚਾਹ ਪੀਂਦੇ ਹਨ', 'Oh khaande han ate oh chah pinde han'),
    (v_seg, 9, 'I can help when you need me.', 'ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ ਜਦੋਂ ਤੁਸੀਂ ਮੈਨੂੰ ਲੋੜਦੇ ਹੋ', 'Mai madad kar sakda haa jadon tusi mainu lorhde ho'),
    (v_seg, 10, 'She sings but he dances.', 'ਉਹ ਗਾਉਂਦੀ ਹੈ ਪਰ ਉਹ ਨਾਚਦਾ ਹੈ', 'Oh gaundi hai par oh nachda hai');

  -- Segment 11 — Using objects naturally
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 11, 11, 'Using objects naturally',
    'icon_hero', '{"icons":["BookOpen"],"label":"Objects complete the sentence","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Many Punjabi verbs sound incomplete on their own. Adding an object—such as a book, food, Punjabi or the house—creates natural, everyday sentences. Read → book. Eat → food. Clean → house. Speak → Punjabi.');

  -- Segment 12 — Translate: Complete sentences
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Translate: Complete sentences',
    'activity_scene', '{"icons":["Languages"],"caption":"Ability + Objects"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi with sakna and the correct object. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I can read the book.', 'ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹ ਸਕਦਾ ਹਾਂ', 'Mai kitaab parh sakda haa'),
    (v_seg, 2, 'She can clean the house.', 'ਉਹ ਘਰ ਸਾਫ਼ ਕਰ ਸਕਦੀ ਹੈ', 'Oh ghar saaf kar sakdi hai'),
    (v_seg, 3, 'We can speak Punjabi.', 'ਅਸੀਂ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹਾਂ', 'Asi Punjabi bol sakde haa'),
    (v_seg, 4, 'They can open the door.', 'ਉਹ ਦਰਵਾਜ਼ਾ ਖੋਲ ਸਕਦੇ ਹਨ', 'Oh darvaza khol sakde han'),
    (v_seg, 5, 'He can wash the clothes.', 'ਉਹ ਕੱਪੜੇ ਧੋ ਸਕਦਾ ਹੈ', 'Oh kapre dho sakda hai'),
    (v_seg, 6, 'I can drive the car.', 'ਮੈਂ ਗੱਡੀ ਚਲਾ ਸਕਦਾ ਹਾਂ', 'Mai gaddi chala sakda haa'),
    (v_seg, 7, 'She can finish the work.', 'ਉਹ ਕੰਮ ਖ਼ਤਮ ਕਰ ਸਕਦੀ ਹੈ', 'Oh kamm khatam kar sakdi hai'),
    (v_seg, 8, 'We can listen to music.', 'ਅਸੀਂ ਸੰਗੀਤ ਸੁਣ ਸਕਦੇ ਹਾਂ', 'Asi sangeet sun sakde haa'),
    (v_seg, 9, 'They can help the teacher.', 'ਉਹ ਅਧਿਆਪਕ ਦੀ ਮਦਦ ਕਰ ਸਕਦੇ ਹਨ', 'Oh adhyaapak di madad kar sakde han'),
    (v_seg, 10, 'You can ask a question.', 'ਤੁਸੀਂ ਸਵਾਲ ਪੁੱਛ ਸਕਦੇ ਹੋ', 'Tusi savaal puch sakde ho');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Talk about ability and connect ideas"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You now know how to use sakna, build ability sentences, join ideas together with connecting words, and include objects to make your Punjabi sound more complete.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 4 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 4 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 4 recap quiz to lock in ability sentences and connecting words.'
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
    (v_seg, 1, 'I can listen and I can speak.', 'ਮੈਂ ਸੁਣ ਸਕਦਾ ਹਾਂ ਅਤੇ ਮੈਂ ਬੋਲ ਸਕਦਾ ਹਾਂ', 'Mai sun sakda haa ate mai bol sakda haa'),
    (v_seg, 2, 'They play outside when she goes.', 'ਉਹ ਬਾਹਰ ਖੇਡਦੇ ਹਨ ਜਦੋਂ ਉਹ ਜਾਂਦੀ ਹੈ', 'Oh bahar khedde han jadon oh jaandi hai'),
    (v_seg, 3, 'You ask questions because you are smart.', 'ਤੁਸੀਂ ਸਵਾਲ ਪੁੱਛਦੇ ਹੋ ਕਿਉਂਕਿ ਤੁਸੀਂ ਹੋਸ਼ਿਆਰ ਹੋ', 'Tusi savaal puchde ho kiunki tusi hoshiyaar ho'),
    (v_seg, 4, 'She cooks food and she can serve food.', 'ਉਹ ਖਾਣਾ ਪਕਾਉਂਦੀ ਹੈ ਅਤੇ ਉਹ ਖਾਣਾ ਪਰੋਸ ਸਕਦੀ ਹੈ', 'Oh khaana pakaundi hai ate oh khaana paros sakdi hai'),
    (v_seg, 5, 'I walk and I go home.', 'ਮੈਂ ਤੁਰਦਾ ਹਾਂ ਅਤੇ ਮੈਂ ਘਰ ਜਾਂਦਾ ਹਾਂ', 'Mai turda haa ate mai ghar jaanda haa'),
    (v_seg, 6, 'We stay home when she works.', 'ਅਸੀਂ ਘਰ ਰਹਿੰਦੇ ਹਾਂ ਜਦੋਂ ਉਹ ਕੰਮ ਕਰਦੀ ਹੈ', 'Asi ghar rehnde haa jadon oh kaam kardi hai'),
    (v_seg, 7, 'I can read the book.', 'ਮੈਂ ਕਿਤਾਬ ਪੜ੍ਹ ਸਕਦਾ ਹਾਂ', 'Mai kitaab parh sakda haa'),
    (v_seg, 8, 'She can help me.', 'ਉਹ ਮੈਨੂੰ ਮਦਦ ਕਰ ਸਕਦੀ ਹੈ', 'Oh mainu madad kar sakdi hai'),
    (v_seg, 9, 'They can speak Punjabi.', 'ਉਹ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹਨ', 'Oh Punjabi bol sakde han'),
    (v_seg, 10, 'We can work together.', 'ਅਸੀਂ ਇਕੱਠੇ ਕੰਮ ਕਰ ਸਕਦੇ ਹਾਂ', 'Asi ikatthe kaam kar sakde haa');

  RAISE NOTICE 'Week 4 catch-up seed complete for lesson %', v_lesson_id;
END $$;
