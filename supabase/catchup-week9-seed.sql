-- =============================================================================
-- Kidda — Week 9 (Future Tense) catch-up seed
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
    AND l.lesson_number = 9
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 9 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Future time expressions on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_9', 'time']::text[]
  FROM (VALUES
    ('tomorrow', 'ਕੱਲ੍ਹ', 'kal'),
    ('next week', 'ਅਗਲੇ ਹਫ਼ਤੇ', 'agle hafte'),
    ('soon', 'ਛੇਤੀ', 'cheti'),
    ('tonight', 'ਅੱਜ ਰਾਤ', 'ajj raat'),
    ('by evening', 'ਸ਼ਾਮ ਤੱਕ', 'shaam takk'),
    ('by morning', 'ਸਵੇਰੇ ਤੱਕ', 'savvere takk')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'tomorrow' AND f.front_text = 'tomorrow')
        OR (v.front = 'next week' AND (f.front_text ILIKE 'next week%' OR f.romanised = 'agle hafte'))
        OR (v.front = 'tonight' AND f.front_text ILIKE 'tonight%')
      )
  );

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 8 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 8 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Talking about the past"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned how to describe completed actions and events in the past. This week you''ll look in the opposite direction and learn how to talk confidently about the future, including things that will happen, will be happening and will have happened.');

  -- Segment 2 — Talking about the future
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Talking about the future',
    'icon_hero', '{"icons":["ClockArrowUp"],"label":"Looking ahead","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Future tense allows you to describe plans, predictions and expectations. Punjabi has several future forms, each expressing a slightly different meaning.');

  -- Segment 3 — Simple future
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Simple future',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Calendar","label":"Tomorrow","sublabel":"I will read.","color":"purple"},
        {"icon":"Clock","label":"Next week","sublabel":"She will come.","color":"teal"},
        {"icon":"Zap","label":"Soon","sublabel":"We will start.","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'The simple future describes something that hasn''t happened yet. This is the most common future tense and forms the foundation for everything else.');

  -- Segment 4 — Future conjugation table
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Future conjugation',
    'conjugation_table',
    '{
      "title": "Simple future — fused endings (e.g. parhna → will read)",
      "columns": ["Pronoun", "Masculine", "Feminine", "Example"],
      "rows": [
        {"Pronoun":"I (mai)","Masculine":"-aanga","Feminine":"-aangi","Example":"mai parhunga"},
        {"Pronoun":"He (oh)","Masculine":"-ega","Feminine":"-egi","Example":"oh aayega"},
        {"Pronoun":"We (asi)","Masculine":"-aange","Feminine":"-aangiaan","Example":"asi parhenge"},
        {"Pronoun":"You (tusi)","Masculine":"-oge","Feminine":"-ogi","Example":"tusi parhoge"},
        {"Pronoun":"They (oh)","Masculine":"-ange","Feminine":"-angiaan","Example":"oh aayenge"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Future tense endings change depending on gender and number, just like many other Punjabi verb forms you''ve already learned.');

  -- Segment 5 — Translate: Simple future
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Translate: Simple future',
    'activity_scene', '{"icons":["Languages"],"caption":"Talking about the future"}'::jsonb,
    'translate', 'Translate each sentence into Punjabi using the simple future. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I will read the book tomorrow.', 'ਮੈਂ ਕੱਲ੍ਹ ਕਿਤਾਬ ਪੜ੍ਹਾਂਗਾ', 'Mai kal kitaab parhunga'),
    (v_seg, 2, 'She will come in the evening.', 'ਉਹ ਸ਼ਾਮ ਨੂੰ ਆਵੇਗੀ', 'Oh shaam nu aavegi'),
    (v_seg, 3, 'We will start the work today.', 'ਅਸੀਂ ਅੱਜ ਕੰਮ ਸ਼ੁਰੂ ਕਰਾਂਗੇ', 'Asi ajj kamm shuru karange'),
    (v_seg, 4, 'He will usually wake up early.', 'ਉਹ ਆਮ ਤੌਰ ''ਤੇ ਜਲਦੀ ਉਠੇਗਾ', 'Oh aam taur te jaldi uthega'),
    (v_seg, 5, 'They will usually work together.', 'ਉਹ ਆਮ ਤੌਰ ''ਤੇ ਇਕੱਠੇ ਕੰਮ ਕਰਾਂਗੇ', 'Oh aam taur te ikatthe kaam karange'),
    (v_seg, 6, 'You will usually eat at home.', 'ਤੁਸੀਂ ਆਮ ਤੌਰ ''ਤੇ ਘਰ ਤੇ ਖਾਣਾ ਖਾਓਗੇ', 'Tusi aam taur te ghar te khana khaoge'),
    (v_seg, 7, 'I will travel next week.', 'ਮੈਂ ਅਗਲੇ ਹਫ਼ਤੇ ਸਫ਼ਰ ਕਰਾਂਗਾ', 'Mai agle hafte safar karunga'),
    (v_seg, 8, 'She will buy a new phone.', 'ਉਹ ਨਵਾਂ ਫ਼ੋਨ ਖਰੀਦੇਗੀ', 'Oh nava phone khareedegi'),
    (v_seg, 9, 'We will learn Punjabi.', 'ਅਸੀਂ ਪੰਜਾਬੀ ਸਿੱਖਾਂਗੇ', 'Asi Punjabi sikhange'),
    (v_seg, 10, 'They will help us.', 'ਉਹ ਸਾਡੀ ਮਦਦ ਕਰਾਂਗੇ', 'Oh saadi madad karange');

  -- Segment 6 — Future continuous
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Future continuous',
    'icon_hero', '{"icons":["LoaderCircle"],"label":"Will be doing","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Future continuous describes an action that will be in progress at a particular time in the future. I will be working — Mai kaam kar reha hovanga. She will be studying — Oh padhai kar rahi hovegi. They will be travelling — Oh safar kar rahe honge.');

  -- Segment 7 — Translate: Future continuous
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Translate: Future continuous',
    'activity_scene', '{"icons":["Languages"],"caption":"Actions in progress"}'::jsonb,
    'translate', 'Translate each sentence using future continuous (reha/rahi/rahe + hovega/honge). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'They will be working late tonight.', 'ਉਹ ਅੱਜ ਰਾਤ ਦੇਰ ਤੱਕ ਕੰਮ ਕਰ ਰਹੇ ਹੋਣਗੇ', 'Oh ajj raat der takk kaam kar rahe honge'),
    (v_seg, 2, 'We will be travelling next week.', 'ਅਸੀਂ ਅਗਲੇ ਹਫ਼ਤੇ ਸਫ਼ਰ ਕਰ ਰਹੇ ਹੋਵਾਂਗੇ', 'Asi agle hafte safar kar rahe hovange'),
    (v_seg, 3, 'She will be studying at this time tomorrow.', 'ਉਹ ਕੱਲ੍ਹ ਇਸ ਸਮੇਂ ਪੜ੍ਹਾਈ ਕਰ ਰਹੀ ਹੋਵੇਗੀ', 'Oh kal iss samen padhai kar rahi hovegi'),
    (v_seg, 4, 'He will be waiting outside.', 'ਉਹ ਬਾਹਰ ਇੰਤਜ਼ਾਰ ਕਰ ਰਿਹਾ ਹੋਵੇਗਾ', 'Oh bahar intzaar kar riha hovega'),
    (v_seg, 5, 'I will be reading this evening.', 'ਮੈਂ ਅੱਜ ਸ਼ਾਮ ਪੜ੍ਹ ਰਿਹਾ ਹੋਵਾਂਗਾ', 'Mai ajj shaam parh riha hovanga'),
    (v_seg, 6, 'We will be eating together.', 'ਅਸੀਂ ਇਕੱਠੇ ਖਾਣਾ ਖਾ ਰਹੇ ਹੋਵਾਂਗੇ', 'Asi ikatthe khana kha rahe hovange'),
    (v_seg, 7, 'They will be watching TV.', 'ਉਹ ਟੀਵੀ ਵੇਖ ਰਹੇ ਹੋਣਗੇ', 'Oh TV vekh rahe honge'),
    (v_seg, 8, 'You will be helping your family.', 'ਤੁਸੀਂ ਆਪਣੇ ਪਰਿਵਾਰ ਦੀ ਮਦਦ ਕਰ ਰਹੇ ਹੋਵੋਗੇ', 'Tusi apne parivar di madad kar rahe hovoge'),
    (v_seg, 9, 'She will be speaking Punjabi.', 'ਉਹ ਪੰਜਾਬੀ ਬੋਲ ਰਹੀ ਹੋਵੇਗੀ', 'Oh Punjabi bol rahi hovegi'),
    (v_seg, 10, 'I will be sleeping.', 'ਮੈਂ ਸੌ ਰਿਹਾ ਹੋਵਾਂਗਾ', 'Mai sou riha hovanga');

  -- Segment 8 — Future perfect
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Future perfect',
    'icon_hero', '{"icons":["CheckCheck"],"label":"Will have finished","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Future perfect describes something that will already be completed before another point in the future. He will have finished the work — Oh kamm khatam kar chukka hovega. They will have arrived — Oh pahunch chukke honge. We will have completed the lesson — Asi paath mukaa chukke hovange.');

  -- Segment 9 — Translate: Future perfect
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 9, 9, 'Translate: Future perfect',
    'activity_scene', '{"icons":["Languages"],"caption":"Completed future actions"}'::jsonb,
    'translate', 'Translate each sentence using future perfect (chukka/chukki + hovega/honge). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'He will have finished the work by evening.', 'ਉਹ ਸ਼ਾਮ ਤੱਕ ਕੰਮ ਖ਼ਤਮ ਕਰ ਚੁੱਕਾ ਹੋਵੇਗਾ', 'Oh shaam takk kamm khatam kar chukka hovega'),
    (v_seg, 2, 'They will have arrived by morning.', 'ਉਹ ਸਵੇਰੇ ਤੱਕ ਪਹੁੰਚ ਚੁੱਕੇ ਹੋਣਗੇ', 'Oh savvere takk pahunch chukke honge'),
    (v_seg, 3, 'We will have completed the lesson.', 'ਅਸੀਂ ਪਾਠ ਮੁਕਾ ਚੁੱਕੇ ਹੋਵਾਂਗੇ', 'Asi paath mukaa chukke hovange'),
    (v_seg, 4, 'She will have read the book.', 'ਉਹ ਕਿਤਾਬ ਪੜ੍ਹ ਚੁੱਕੀ ਹੋਵੇਗੀ', 'Oh kitaab parh chukki hovegi'),
    (v_seg, 5, 'I will have cleaned the house.', 'ਮੈਂ ਘਰ ਸਾਫ਼ ਕਰ ਚੁੱਕਾ ਹੋਵਾਂਗਾ', 'Mai ghar saaf kar chukka hovanga'),
    (v_seg, 6, 'They will have eaten dinner.', 'ਉਹ ਰਾਤ ਦਾ ਖਾਣਾ ਖਾ ਚੁੱਕੇ ਹੋਣਗੇ', 'Oh raat da khana kha chukke honge'),
    (v_seg, 7, 'He will have spoken to the teacher.', 'ਉਹ ਅਧਿਆਪਕ ਨਾਲ ਗੱਲ ਕਰ ਚੁੱਕਾ ਹੋਵੇਗਾ', 'Oh adhyaapak naal gall kar chukka hovega'),
    (v_seg, 8, 'We will have travelled home.', 'ਅਸੀਂ ਘਰ ਪਹੁੰਚ ਚੁੱਕੇ ਹੋਵਾਂਗੇ', 'Asi ghar pahunch chukke hovange'),
    (v_seg, 9, 'She will have bought the gift.', 'ਉਹ ਤੋਹਫ਼ਾ ਖਰੀਦ ਚੁੱਕੀ ਹੋਵੇਗੀ', 'Oh tohfa khareed chukki hovegi'),
    (v_seg, 10, 'You will have written the letter.', 'ਤੁਸੀਂ ਚਿੱਠੀ ਲਿਖ ਚੁੱਕੇ ਹੋਵੋਗੇ', 'Tusi chitthi likh chukke hovoge');

  -- Segment 10 — Future ability and necessity
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Future ability and necessity',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Sparkles","label":"Future ability","sublabel":"I will be able to help.","color":"purple"},
        {"icon":"TriangleAlert","label":"Future necessity","sublabel":"We will have to wait.","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi extends the same ideas you''ve already learned into the future. You can describe what someone will be able to do, or what they will have to do.');

  -- Segment 11 — Translate: Future ability & necessity
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Translate: Future ability & necessity',
    'activity_scene', '{"icons":["Languages"],"caption":"Ability and necessity"}'::jsonb,
    'translate', 'Translate using future ability (sakaanga/sakegi) or necessity (pavega/pavena). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I will be able to read this book.', 'ਮੈਂ ਇਹ ਕਿਤਾਬ ਪੜ੍ਹ ਸਕਾਂਗਾ', 'Mai ih kitaab parh sakaanga'),
    (v_seg, 2, 'She will be able to come tomorrow.', 'ਉਹ ਕੱਲ੍ਹ ਆ ਸਕੇਗੀ', 'Oh kal aa sakegi'),
    (v_seg, 3, 'We will be able to finish the work today.', 'ਅਸੀਂ ਅੱਜ ਕੰਮ ਖ਼ਤਮ ਕਰ ਸਕਾਂਗੇ', 'Asi ajj kamm khatam kar sakaange'),
    (v_seg, 4, 'You will be able to help me.', 'ਤੁਸੀਂ ਮੈਨੂੰ ਮਦਦ ਕਰ ਸਕੋਗੇ', 'Tusi mainu madad kar sakoge'),
    (v_seg, 5, 'They will be able to travel next week.', 'ਉਹ ਅਗਲੇ ਹਫ਼ਤੇ ਸਫ਼ਰ ਕਰ ਸਕਣਗੇ', 'Oh agle hafte safar kar sakange'),
    (v_seg, 6, 'I will have to work tomorrow.', 'ਮੈਨੂੰ ਕੱਲ੍ਹ ਕੰਮ ਕਰਨਾ ਪਵੇਗਾ', 'Mainu kal kaam karna pavega'),
    (v_seg, 7, 'He will have to leave early.', 'ਉਸਨੂੰ ਜਲਦੀ ਜਾਣਾ ਪਵੇਗਾ', 'Usnu jaldi jaana pavega'),
    (v_seg, 8, 'We will have to wait here.', 'ਸਾਨੂੰ ਇੱਥੇ ਇੰਤਜ਼ਾਰ ਕਰਨਾ ਪਵੇਗਾ', 'Sanu itthe intzaar karna pavega'),
    (v_seg, 9, 'You will have to read this book.', 'ਤੁਹਾਨੂੰ ਇਹ ਕਿਤਾਬ ਪੜ੍ਹਨੀ ਪਵੇਗੀ', 'Tuhaanu ih kitaab parhni pavegi'),
    (v_seg, 10, 'They will have to clean the house.', 'ਉਹਨਾਂਨੂੰ ਘਰ ਸਾਫ਼ ਕਰਨਾ ਪਵੇਗਾ', 'Uhanaanu ghar saaf karna pavega');

  -- Segment 12 — Building future conversations (fill blank)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Building future conversations',
    'activity_scene', '{"icons":["MessagesSquare"],"caption":"Planning ahead"}'::jsonb,
    'fill_blank', 'Complete each sentence with a future-tense verb phrase. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਕੱਲ੍ਹ ਮੈਂ ___', 'Kal mai ___', 'Tomorrow I will ______.', 'ਪੜ੍ਹਾਂਗਾ', 'parhunga'),
    (v_seg, 2, 'ਅਗਲੇ ਹਫ਼ਤੇ ਅਸੀਂ ___', 'Agle hafte asi ___', 'Next week we will ______.', 'ਸਫ਼ਰ ਕਰਾਂਗੇ', 'safar karange'),
    (v_seg, 3, 'ਅੱਜ ਸ਼ਾਮ ਉਹ ___', 'Ajj shaam oh ___', 'This evening she will ______.', 'ਆਵੇਗੀ', 'aavegi'),
    (v_seg, 4, 'ਉਹ ___ ਰਹੇ ਹੋਣਗੇ', 'Oh ___ rahe honge', 'They will be ______.', 'ਕੰਮ ਕਰ ਰਹੇ', 'kaam kar rahe'),
    (v_seg, 5, 'ਅਸੀਂ ___ ਚੁੱਕੇ ਹੋਵਾਂਗੇ', 'Asi ___ chukke hovange', 'We will have ______.', 'ਪਾਠ ਮੁਕਾ', 'paath mukaa');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Talk confidently about the future"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now describe future plans, future actions in progress, completed future events, future ability and future necessity.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 9 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 9 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 9 recap quiz to lock in future tense patterns.'
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
    (v_seg, 1, 'I will read the book tomorrow.', 'ਮੈਂ ਕੱਲ੍ਹ ਕਿਤਾਬ ਪੜ੍ਹਾਂਗਾ', 'Mai kal kitaab parhunga'),
    (v_seg, 2, 'She will come in the evening.', 'ਉਹ ਸ਼ਾਮ ਨੂੰ ਆਵੇਗੀ', 'Oh shaam nu aavegi'),
    (v_seg, 3, 'We will start the work today.', 'ਅਸੀਂ ਅੱਜ ਕੰਮ ਸ਼ੁਰੂ ਕਰਾਂਗੇ', 'Asi ajj kamm shuru karange'),
    (v_seg, 4, 'He will usually wake up early.', 'ਉਹ ਆਮ ਤੌਰ ''ਤੇ ਜਲਦੀ ਉਠੇਗਾ', 'Oh aam taur te jaldi uthega'),
    (v_seg, 5, 'They will usually work together.', 'ਉਹ ਆਮ ਤੌਰ ''ਤੇ ਇਕੱਠੇ ਕੰਮ ਕਰਾਂਗੇ', 'Oh aam taur te ikatthe kaam karange'),
    (v_seg, 6, 'You will usually eat at home.', 'ਤੁਸੀਂ ਆਮ ਤੌਰ ''ਤੇ ਘਰ ਤੇ ਖਾਣਾ ਖਾਓਗੇ', 'Tusi aam taur te ghar te khana khaoge'),
    (v_seg, 7, 'They will be working late tonight.', 'ਉਹ ਅੱਜ ਰਾਤ ਦੇਰ ਤੱਕ ਕੰਮ ਕਰ ਰਹੇ ਹੋਣਗੇ', 'Oh ajj raat der takk kaam kar rahe honge'),
    (v_seg, 8, 'We will be travelling next week.', 'ਅਸੀਂ ਅਗਲੇ ਹਫ਼ਤੇ ਸਫ਼ਰ ਕਰ ਰਹੇ ਹੋਵਾਂਗੇ', 'Asi agle hafte safar kar rahe hovange'),
    (v_seg, 9, 'She will be studying at this time tomorrow.', 'ਉਹ ਕੱਲ੍ਹ ਇਸ ਸਮੇਂ ਪੜ੍ਹਾਈ ਕਰ ਰਹੀ ਹੋਵੇਗੀ', 'Oh kal iss samen padhai kar rahi hovegi'),
    (v_seg, 10, 'He will have finished the work by evening.', 'ਉਹ ਸ਼ਾਮ ਤੱਕ ਕੰਮ ਖ਼ਤਮ ਕਰ ਚੁੱਕਾ ਹੋਵੇਗਾ', 'Oh shaam takk kamm khatam kar chukka hovega'),
    (v_seg, 11, 'They will have arrived by morning.', 'ਉਹ ਸਵੇਰੇ ਤੱਕ ਪਹੁੰਚ ਚੁੱਕੇ ਹੋਣਗੇ', 'Oh savvere takk pahunch chukke honge'),
    (v_seg, 12, 'I will be able to help you.', 'ਮੈਂ ਤੁਹਾਡੀ ਮਦਦ ਕਰ ਸਕਾਂਗਾ', 'Mai tuhadi madad kar sakaanga'),
    (v_seg, 13, 'She will be able to read this document.', 'ਉਹ ਇਹ ਦਸਤਾਵੇਜ਼ ਪੜ੍ਹ ਸਕੇਗੀ', 'Oh ih dastavej parh sakegi'),
    (v_seg, 14, 'We will have to wait here.', 'ਸਾਨੂੰ ਇੱਥੇ ਇੰਤਜ਼ਾਰ ਕਰਨਾ ਪਵੇਗਾ', 'Sanu itthe intzaar karna pavega'),
    (v_seg, 15, 'You will have to send the letter.', 'ਤੁਹਾਨੂੰ ਚਿੱਠੀ ਭੇਜਣੀ ਪਵੇਗੀ', 'Tuhaanu chitthi bhejni pavegi');

  RAISE NOTICE 'Week 9 catch-up seed complete for lesson %', v_lesson_id;
END $$;
