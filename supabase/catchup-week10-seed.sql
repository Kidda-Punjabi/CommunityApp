-- =============================================================================
-- Kidda — Week 10 (Imperatives + Presentation Preparation) catch-up seed
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
  v_week10_imperatives_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 10
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 10 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Dedicated Week 10 imperatives deck (idempotent)
  SELECT id INTO v_week10_imperatives_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 10 - Classroom imperatives'
  LIMIT 1;

  IF v_week10_imperatives_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 10 - Classroom imperatives',
      'Everyday imperative commands for Week 10 catch-up.'
    )
    RETURNING id INTO v_week10_imperatives_deck_id;
  END IF;

  -- Imperative command cards on master deck (create only if missing)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_10', 'imperative']::text[]
  FROM (VALUES
    ('Sit.', 'ਬੈਠੋ', 'baitho'),
    ('Stand.', 'ਖੜੋ', 'kharo'),
    ('Come.', 'ਆਉ', 'aao'),
    ('Go.', 'ਜਾਉ', 'jao'),
    ('Listen.', 'ਸੁਣੋ', 'suno'),
    ('Read.', 'ਪੜ੍ਹੋ', 'parho'),
    ('Write.', 'ਲਿਖੋ', 'likho'),
    ('Speak.', 'ਬੋਲੋ', 'bolo'),
    ('Wait.', 'ਰੁੱਕੋ', 'ruko'),
    ('Help.', 'ਮਦਦ ਕਰੋ', 'madad karo')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front = 'Sit.' AND (f.front_text ILIKE 'sit.%' OR f.romanised = 'baitho'))
        OR (v.front = 'Stand.' AND (f.front_text ILIKE 'stand.%' OR f.romanised IN ('kharo', 'khade ho')))
        OR (v.front = 'Come.' AND (f.front_text ILIKE 'come.%' OR f.romanised = 'aao'))
        OR (v.front = 'Go.' AND (f.front_text ILIKE 'go.%' OR f.romanised = 'jao'))
        OR (v.front = 'Listen.' AND (f.front_text ILIKE 'listen.%' OR f.romanised = 'suno'))
        OR (v.front = 'Read.' AND (f.front_text ILIKE 'read.%' OR f.romanised = 'parho'))
        OR (v.front = 'Write.' AND (f.front_text ILIKE 'write.%' OR f.romanised = 'likho'))
        OR (v.front = 'Speak.' AND (f.front_text ILIKE 'speak.%' OR f.romanised = 'bolo'))
        OR (v.front = 'Wait.' AND (f.front_text ILIKE 'wait.%' OR f.romanised IN ('ruko', 'ruk')))
        OR (v.front = 'Help.' AND (f.front_text ILIKE 'help.%' OR f.romanised ILIKE '%madad%'))
      )
  );

  -- Populate Week 10 deck from master imperative commands
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT DISTINCT ON (f.front_text)
    v_week10_imperatives_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'vocab'),
    'Week 10 - Classroom imperatives',
    ARRAY['week_10', 'imperative']::text[]
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND f.front_text IN (
      'Sit.', 'Stand.', 'Come.', 'Go.', 'Listen.',
      'Read.', 'Write.', 'Speak.', 'Wait.', 'Help.'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_week10_imperatives_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 9 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 9 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Talking about the future"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned how to describe future events, ongoing future actions, completed future actions, and future ability and necessity. This week you''ll learn how to give instructions, requests and commands naturally in Punjabi, before beginning preparation for your final presentation.');

  -- Segment 2 — What are imperatives?
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'What are imperatives?',
    'icon_hero', '{"icons":["Megaphone"],"label":"Giving instructions","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'An imperative tells someone to do something. We use imperatives every day when giving directions, asking for help, making requests or encouraging someone. Punjabi has several levels of politeness depending on who you''re speaking to.');

  -- Segment 3 — Different levels of politeness
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Different levels of politeness',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Smile","label":"Friendly","sublabel":"Sit.","color":"purple"},
        {"icon":"Minus","label":"Neutral","sublabel":"Please sit.","color":"teal"},
        {"icon":"Crown","label":"Respectful","sublabel":"Please have a seat.","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Unlike English, Punjabi changes imperative forms depending on who you''re speaking to. The same instruction sounds different when talking to a close friend compared with an elder or someone you respect.');

  -- Segment 4 — Building imperative sentences (reference table)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Building imperative sentences',
    'conjugation_table',
    '{
      "title": "Imperative forms — same verb, three registers (e.g. baithna → sit)",
      "columns": ["Register", "Who you address", "Ending", "Example (sit)", "Example (come)"],
      "rows": [
        {"Register":"Friendly","Who you address":"tu (one person, informal)","Ending":"verb root","Example (sit)":"baith","Example (come)":"aa"},
        {"Register":"Neutral","Who you address":"tusi (you plural / polite)","Ending":"-o","Example (sit)":"baitho","Example (come)":"aao"},
        {"Register":"Respectful","Who you address":"tusi (formal / elders)","Ending":"-iye","Example (sit)":"baithiye","Example (come)":"aaiye"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Imperatives often remove the subject completely. Instead of saying ''You sit'', Punjabi simply says ''Sit''.');

  -- Segment 5 — Common classroom imperatives (flashcards)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Common classroom imperatives',
    'icon_hero', '{"icons":["BookOpen"],"label":"Everyday commands","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_week10_imperatives_deck_id,
    'Review these everyday classroom commands. Most reuse verbs you already know — now in imperative form.'
  ) RETURNING id INTO v_seg;

  -- Segment 6 — Translate: Imperatives
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Translate: Imperatives',
    'activity_scene', '{"icons":["Languages"],"caption":"Giving instructions"}'::jsonb,
    'translate', 'Translate each command into Punjabi using the neutral tusi imperative (-o). Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Sit down.', 'ਬੈਠ ਜਾਓ', 'Baith jao'),
    (v_seg, 2, 'Stand up.', 'ਖੜੋ', 'Kharo'),
    (v_seg, 3, 'Come here.', 'ਇੱਥੇ ਆਉ', 'Ithe aao'),
    (v_seg, 4, 'Go home.', 'ਘਰ ਜਾਉ', 'Ghar jao'),
    (v_seg, 5, 'Read the book.', 'ਕਿਤਾਬ ਪੜ੍ਹੋ', 'Kitaab parho'),
    (v_seg, 6, 'Write your name.', 'ਆਪਣਾ ਨਾਮ ਲਿਖੋ', 'Apna naam likho'),
    (v_seg, 7, 'Listen carefully.', 'ਧਿਆਨ ਨਾਲ ਸੁਣੋ', 'Dhyaan naal suno'),
    (v_seg, 8, 'Speak Punjabi.', 'ਪੰਜਾਬੀ ਬੋਲੋ', 'Punjabi bolo'),
    (v_seg, 9, 'Wait here.', 'ਇੱਥੇ ਰੁੱਕੋ', 'Ithe ruko'),
    (v_seg, 10, 'Help me.', 'ਮੇਰੀ ਮਦਦ ਕਰੋ', 'Meri madad karo');

  -- Segment 7 — Making polite requests
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 7, 7, 'Making polite requests',
    'icon_hero', '{"icons":["Handshake"],"label":"Being polite","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Not every imperative is a command. Punjabi also uses imperative forms to make polite requests. Tone and word choice make the difference. Kirpa karke baitho — Please sit. Kirpa karke meri madad karo — Please help me. Kirpa karke ruko — Please wait.');

  -- Segment 8 — Translate: Polite requests
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 8, 8, 'Translate: Polite requests',
    'activity_scene', '{"icons":["Languages"],"caption":"Polite Punjabi"}'::jsonb,
    'translate', 'Translate each polite request using kirpa karke + imperative. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Please sit here.', 'ਕਿਰਪਾ ਕਰਕੇ ਇੱਥੇ ਬੈਠੋ', 'Kirpa karke ithe baitho'),
    (v_seg, 2, 'Please listen carefully.', 'ਕਿਰਪਾ ਕਰਕੇ ਧਿਆਨ ਨਾਲ ਸੁਣੋ', 'Kirpa karke dhyaan naal suno'),
    (v_seg, 3, 'Please help me.', 'ਕਿਰਪਾ ਕਰਕੇ ਮੇਰੀ ਮਦਦ ਕਰੋ', 'Kirpa karke meri madad karo'),
    (v_seg, 4, 'Please read this.', 'ਕਿਰਪਾ ਕਰਕੇ ਇਹ ਪੜ੍ਹੋ', 'Kirpa karke ih parho'),
    (v_seg, 5, 'Please come tomorrow.', 'ਕਿਰਪਾ ਕਰਕੇ ਕੱਲ੍ਹ ਆਉ', 'Kirpa karke kal aao'),
    (v_seg, 6, 'Please speak slowly.', 'ਕਿਰਪਾ ਕਰਕੇ ਹੌਲੀ ਬੋਲੋ', 'Kirpa karke hauli bolo'),
    (v_seg, 7, 'Please wait outside.', 'ਕਿਰਪਾ ਕਰਕੇ ਬਾਹਰ ਰੁੱਕੋ', 'Kirpa karke bahar ruko'),
    (v_seg, 8, 'Please start now.', 'ਕਿਰਪਾ ਕਰਕੇ ਹੁਣ ਸ਼ੁਰੂ ਕਰੋ', 'Kirpa karke hun shuru karo'),
    (v_seg, 9, 'Please finish your work.', 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਕੰਮ ਖ਼ਤਮ ਕਰੋ', 'Kirpa karke apna kamm khatam karo'),
    (v_seg, 10, 'Please write your answer.', 'ਕਿਰਪਾ ਕਰਕੇ ਆਪਣਾ ਜਵਾਬ ਲਿਖੋ', 'Kirpa karke apna jawab likho');

  -- Segment 9 — Preparing for the presentation
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Preparing for the presentation',
    'icon_hero', '{"icons":["Presentation"],"label":"Presentation planning","accentColor":"coral"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You now know enough Punjabi to speak about yourself. Over the next two weeks you''ll begin preparing a short presentation using everything you''ve learned so far.');

  -- Segment 10 — Building your presentation
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Building your presentation',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"User","label":"Introduce yourself"},
        {"icon":"Users","label":"Your family"},
        {"icon":"Heart","label":"Your hobbies"},
        {"icon":"Sun","label":"Your daily routine"},
        {"icon":"GraduationCap","label":"Why you''re learning Punjabi"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'A good presentation doesn''t use difficult grammar. It combines simple sentences confidently. Everything you''ve learned throughout the course is enough.');

  -- Segment 11 — Presentation builder (fill blank)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Presentation builder',
    'activity_scene', '{"icons":["NotebookPen"],"caption":"Create your own presentation"}'::jsonb,
    'fill_blank', 'Complete each sentence with your own details. The examples show one possibility — use your real name, place, hobbies and reasons.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਮੇਰਾ ਨਾਮ ___ ਹੈ', 'Mera naam ___ hai', 'My name is ______.', 'ਸਿਮਰਨ', 'Simran'),
    (v_seg, 2, 'ਮੈਂ ___ ਵਿਚ ਰਹਿੰਦਾ ਹਾਂ', 'Mai ___ vich rehnda haa', 'I live in ______.', 'ਲੰਡਨ', 'London'),
    (v_seg, 3, 'ਮੈਨੂੰ ___ ਪਸੰਦ ਹੈ', 'Mainu ___ pasand hai', 'I enjoy ______.', 'ਪੜ੍ਹਨਾ', 'parhna'),
    (v_seg, 4, 'ਮੈਂ ਆਮ ਤੌਰ ''ਤੇ ___', 'Mai aam taur te ___', 'I usually ______.', 'ਸਵੇਰੇ ਜਲਦੀ ਉਠਦਾ ਹਾਂ', 'savvere jaldi uthda haa'),
    (v_seg, 5, 'ਮੈਂ ਪੰਜਾਬੀ ਇਸ ਲਈ ਸਿੱਖ ਰਿਹਾ ਹਾਂ ਕਿ ___', 'Mai Punjabi is liye sikh riha haa ki ___', 'I am learning Punjabi because ______.', 'ਮੈਂ ਆਪਣੇ ਪਰਿਵਾਰ ਨਾਲ ਗੱਲ ਕਰ ਸਕਦਾ ਹਾਂ', 'mai apne parivar naal gall kar sakda haa');

  -- Segment 12 — Presentation checklist
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Presentation checklist',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Mic","label":"Speak clearly","sublabel":"Take your time","color":"purple"},
        {"icon":"BookOpen","label":"Use simple grammar","sublabel":"Short sentences win","color":"teal"},
        {"icon":"Timer","label":"Don''t rush","sublabel":"Pause between ideas","color":"amber"},
        {"icon":"RefreshCw","label":"Keep going if you make mistakes","sublabel":"Confidence matters","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Confidence is more important than perfection. Focus on communicating rather than remembering every grammar rule.');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Give instructions and prepare your presentation"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You can now give commands, make polite requests, and begin building a confident Punjabi presentation using everything you''ve learned so far.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Week 10 recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 10 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 10 recap quiz to lock in imperative forms and presentation skills.'
  );

  -- Segment 15 — Presentation draft homework (open text, tutor review)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: prepare your presentation","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Write a draft of your presentation below — one answer per prompt. Romanised Punjabi is fine. Your tutor will review your draft.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Your introduction (name and greeting).', NULL, '(Open response — e.g. Mera naam ... hai. Sat Sri Akal.)'),
    (v_seg, 2, 'Where you live.', NULL, '(Open response — e.g. Main London vich rehnda haa.)'),
    (v_seg, 3, 'Your family.', NULL, '(Open response — e.g. Mera parivar ... hai.)'),
    (v_seg, 4, 'Your hobbies.', NULL, '(Open response — e.g. Mainu ... pasand hai.)'),
    (v_seg, 5, 'Your daily routine.', NULL, '(Open response — e.g. Mai subah ... karada haa.)'),
    (v_seg, 6, 'Why you are learning Punjabi.', NULL, '(Open response — e.g. Main Punjabi is liye sikh raha haa ki ... )'),
    (v_seg, 7, 'One thing you want to do in the future.', NULL, '(Open response — future tense sentence)'),
    (v_seg, 8, 'One story from the past.', NULL, '(Open response — past tense sentence)'),
    (v_seg, 9, 'One thing you can do.', NULL, '(Open response — e.g. Mai ... sakda haa.)'),
    (v_seg, 10, 'One question you could ask another student.', NULL, '(Open response — e.g. Tuhada naam ki hai?)');

  RAISE NOTICE 'Week 10 catch-up seed complete for lesson %', v_lesson_id;
END $$;
