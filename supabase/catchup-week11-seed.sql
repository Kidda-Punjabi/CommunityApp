-- =============================================================================
-- Kidda — Week 11 (Presentation Preparation + Course Recap) catch-up seed
-- Run after:
--   supabase/catchup-lesson-segments.sql
--   supabase/catchup-teaching-visuals.sql
--   supabase/catchup-week2-activities.sql
--   supabase/homework-submissions-text.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 11
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 11 not found.';
  END IF;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Course recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Course recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Almost there","subheading":"Let''s bring everything together"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Over the last ten weeks you''ve built the foundations of conversational Punjabi. You can introduce yourself, describe your life, talk about the past, present and future, ask questions and hold short conversations. This week is about bringing all of those skills together before your final presentation.');

  -- Segment 2 — Your Punjabi toolkit
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Your Punjabi toolkit',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"User","label":"Introductions","sublabel":"Name, greeting, background","color":"purple"},
        {"icon":"Sun","label":"Daily life","sublabel":"Routine and habits","color":"teal"},
        {"icon":"Users","label":"Family","sublabel":"People close to you","color":"amber"},
        {"icon":"Heart","label":"Hobbies","sublabel":"What you enjoy","color":"coral"},
        {"icon":"BookOpen","label":"Grammar","sublabel":"Tenses and structures","color":"green"},
        {"icon":"MessagesSquare","label":"Conversations","sublabel":"Questions and answers","color":"purple"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Instead of learning something completely new, we''re reviewing everything you''ve already learned and practising using it naturally.');

  -- Segment 3 — Grammar timeline
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Grammar timeline',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Circle","label":"Present","sublabel":"I speak / I read","color":"purple"},
        {"icon":"LoaderCircle","label":"Continuous","sublabel":"I am speaking","color":"teal"},
        {"icon":"History","label":"Past","sublabel":"I spoke / I read","color":"amber"},
        {"icon":"ClockArrowUp","label":"Future","sublabel":"I will speak","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You now know how to talk about what happens now, what is happening, what happened, and what will happen. Choosing the correct tense is now simply choosing the correct point in time.');

  -- Segment 4 — Conversation checklist
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Conversation checklist',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"MessageCircleQuestion","label":"Ask questions"},
        {"icon":"MessageSquare","label":"Answer naturally"},
        {"icon":"Users","label":"Describe people"},
        {"icon":"ThumbsUp","label":"Give opinions"},
        {"icon":"Mic","label":"Speak confidently"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Real conversations aren''t about remembering grammar rules. They''re about communicating clearly. Your goal is to keep the conversation moving.');

  -- Segment 5 — Quick-fire translation
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Quick-fire translation',
    'activity_scene', '{"icons":["Languages"],"caption":"Mixed grammar review"}'::jsonb,
    'translate', 'Translate each sentence into Punjabi, drawing on grammar from Weeks 1–10. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I speak Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲਦਾ ਹਾਂ', 'Mai Punjabi bolda haa'),
    (v_seg, 2, 'I am learning Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ', 'Mai Punjabi sikh riha haa'),
    (v_seg, 3, 'I learned Punjabi yesterday.', 'ਮੈਂ ਕੱਲ੍ਹ ਪੰਜਾਬੀ ਸਿੱਖੀ', 'Mai kal Punjabi sikhia'),
    (v_seg, 4, 'I will learn Punjabi tomorrow.', 'ਮੈਂ ਕੱਲ੍ਹ ਪੰਜਾਬੀ ਸਿੱਖਾਂਗਾ', 'Mai kal Punjabi sikhunga'),
    (v_seg, 5, 'I can speak Punjabi.', 'ਮੈਂ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦਾ ਹਾਂ', 'Mai Punjabi bol sakda haa'),
    (v_seg, 6, 'I want to learn Punjabi.', 'ਮੈਨੂੰ ਪੰਜਾਬੀ ਸਿੱਖਣਾ ਚਾਹੀਦਾ ਹੈ', 'Mainu Punjabi sikhna chahida hai'),
    (v_seg, 7, 'I need to practise.', 'ਮੈਨੂੰ ਅਭਿਆਸ ਕਰਨਾ ਪੈਂਦਾ ਹੈ', 'Mainu abhyaas karna painda hai'),
    (v_seg, 8, 'She has a new car.', 'ਉਸਦੇ ਕੋਲ ਨਵੀਂ ਗੱਡੀ ਹੈ', 'Usde kol navi gaddi hai'),
    (v_seg, 9, 'Where do you live?', 'ਤੁਸੀਂ ਕਿੱਥੇ ਰਹਿੰਦੇ ਹੋ?', 'Tusi kithhe rehnde ho?'),
    (v_seg, 10, 'Why are you laughing?', 'ਤੁਸੀਂ ਕਿਉਂ ਹੱਸਦੇ ਹੋ?', 'Tusi kiun hasde ho?');

  -- Segment 6 — Everyday conversation
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Everyday conversation',
    'activity_scene', '{"icons":["MessagesSquare"],"caption":"Build natural conversations"}'::jsonb,
    'fill_blank', 'Complete each sentence with your own details. Any correct Punjabi phrase using vocabulary you know is fine — examples show one possibility.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਮੇਰਾ ਨਾਮ ___ ਹੈ', 'Mera naam ___ hai', 'My name is ______.', 'ਰਾਜ', 'Raj'),
    (v_seg, 2, 'ਮੈਂ ___ ਵਿਚ ਰਹਿੰਦਾ ਹਾਂ', 'Mai ___ vich rehnda haa', 'I live in ______.', 'ਲੰਡਨ', 'London'),
    (v_seg, 3, 'ਮੈਂ ___ ਵਜੋਂ ਕੰਮ ਕਰਦਾ ਹਾਂ', 'Mai ___ vajon kaam karda haa', 'I work as ______.', 'ਅਧਿਆਪਕ', 'adhyaapak'),
    (v_seg, 4, 'ਮੇਰਾ ਸ਼ੌਕ ___ ਹੈ', 'Mera shauq ___ hai', 'My hobby is ______.', 'ਪੜ੍ਹਨਾ', 'parhna'),
    (v_seg, 5, 'ਮੈਂ ਆਮ ਤੌਰ ''ਤੇ ___', 'Mai aam taur te ___', 'I usually ______.', 'ਸਵੇਰੇ ਜਲਦੀ ਉਠਦਾ ਹਾਂ', 'savvere jaldi uthda haa');

  -- Segment 7 — Presentation structure
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 7, 7, 'Presentation structure',
    'icon_hero', '{"icons":["Presentation"],"label":"A simple presentation","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'A great presentation isn''t complicated. It simply tells a story about you. A simple structure works well: introduce yourself, talk about your family, your work or studies, your hobbies, why you''re learning Punjabi, and your future goals.');

  -- Segment 8 — Building smoother transitions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Building smoother transitions',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Plus","label":"And… (ate)"},
        {"icon":"HelpCircle","label":"Because… (kiunki)"},
        {"icon":"ArrowRight","label":"Then… (phir)"},
        {"icon":"Repeat","label":"Usually… (aam taur te)"},
        {"icon":"Flag","label":"Finally… (aakhirkar)"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Connecting words help your presentation flow naturally. Rather than speaking in isolated sentences, link your ideas together. Ate — and. Kiunki — because. Phir — then. Aam taur te — usually. Aakhirkar — finally.');

  -- Segment 9 — Presentation builder
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 9, 9, 'Presentation builder',
    'activity_scene', '{"icons":["NotebookPen"],"caption":"Write your presentation"}'::jsonb,
    'fill_blank', 'Write your own presentation using the frames below. Use your real details — exemplar answers show one possible response.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੇਰਾ ਨਾਮ ___ ਹੈ', 'Sat Sri Akal, mera naam ___ hai', 'Introduction', 'ਸਿਮਰਨ', 'Simran'),
    (v_seg, 2, 'ਮੇਰੇ ਪਰਿਵਾਰ ਵਿੱਚ ___ ਹਨ', 'Mere parivar vich ___ han', 'Family', 'ਮੇਰੇ ਮਾਪੇ ਅਤੇ ਭੈਣ', 'mere maape ate bhain'),
    (v_seg, 3, 'ਮੈਂ ___ ਵਜੋਂ ਕੰਮ ਕਰਦਾ ਹਾਂ', 'Mai ___ vajon kaam karda haa', 'Work or studies', 'ਅਧਿਆਪਕ', 'adhyaapak'),
    (v_seg, 4, 'ਮੈਨੂੰ ___ ਪਸੰਦ ਹੈ', 'Mainu ___ pasand hai', 'Hobbies', 'ਪੜ੍ਹਨਾ', 'parhna'),
    (v_seg, 5, 'ਮੈਂ ਆਮ ਤੌਰ ''ਤੇ ___', 'Mai aam taur te ___', 'Daily routine', 'ਸਵੇਰੇ ਜਲਦੀ ਉਠਦਾ ਹਾਂ', 'savvere jaldi uthda haa'),
    (v_seg, 6, 'ਮੈਂ ਪੰਜਾਬੀ ਇਸ ਲਈ ਸਿੱਖ ਰਿਹਾ ਹਾਂ ਕਿ ___', 'Mai Punjabi is liye sikh riha haa ki ___', 'Why Punjabi', 'ਮੈਂ ਆਪਣੇ ਪਰਿਵਾਰ ਨਾਲ ਗੱਲ ਕਰ ਸਕਦਾ ਹਾਂ', 'mai apne parivar naal gall kar sakda haa'),
    (v_seg, 7, 'ਅਗਲੇ ਸਾਲ ਮੈਂ ___', 'Agle saal mai ___', 'Future plans', 'ਪੰਜਾਬ ਜਾਵਾਂਗਾ', 'Punjab jaavanga');

  -- Segment 10 — Answering questions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Answering questions',
    'icon_hero', '{"icons":["MessageCircleQuestion"],"label":"After your presentation","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'After your presentation your tutor will ask a few simple follow-up questions. These aren''t designed to catch you out—they''re simply a chance to demonstrate your understanding. Be ready for questions like: Why are you learning Punjabi? What do you enjoy doing? Where do you live? What did you do yesterday? What will you do tomorrow?');

  -- Segment 11 — Practice follow-up questions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Practice follow-up questions',
    'activity_scene', '{"icons":["MessagesSquare"],"caption":"Presentation practice"}'::jsonb,
    'fill_blank', 'Answer each follow-up question in Punjabi. Write your own response — exemplar answers show one possibility.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਤੁਹਾਡਾ ਨਾਮ ਕੀ ਹੈ? ___', 'Tuhada naam ki hai? ___', 'What is your name?', 'ਮੇਰਾ ਨਾਮ ਰਾਜ ਹੈ', 'mera naam Raj hai'),
    (v_seg, 2, 'ਤੁਸੀਂ ਕਿੱਥੇ ਰਹਿੰਦੇ ਹੋ? ___', 'Tusi kithhe rehnde ho? ___', 'Where do you live?', 'ਮੈਂ ਲੰਡਨ ਵਿਚ ਰਹਿੰਦਾ ਹਾਂ', 'mai London vich rehnda haa'),
    (v_seg, 3, 'ਤੁਸੀਂ ਕੀ ਕਰਦੇ ਹੋ? ___', 'Tusi ki karde ho? ___', 'What do you do?', 'ਮੈਂ ਅਧਿਆਪਕ ਹਾਂ', 'mai adhyaapak haa'),
    (v_seg, 4, 'ਤੁਸੀਂ ਪੰਜਾਬੀ ਕਿਉਂ ਸਿੱਖ ਰਹੇ ਹੋ? ___', 'Tusi Punjabi kiun sikh rahe ho? ___', 'Why are you learning Punjabi?', 'ਮੈਂ ਆਪਣੇ ਪਰਿਵਾਰ ਨਾਲ ਗੱਲ ਕਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ', 'mai apne parivar naal gall karna chahunda haa'),
    (v_seg, 5, 'ਤੁਹਾਡੇ ਸ਼ੌਕ ਕੀ ਹਨ? ___', 'Tuhade shauq ki han? ___', 'What are your hobbies?', 'ਮੈਨੂੰ ਪੜ੍ਹਨਾ ਪਸੰਦ ਹੈ', 'mainu parhna pasand hai'),
    (v_seg, 6, 'ਤੁਸੀਂ ਕੱਲ੍ਹ ਕੀ ਕੀਤਾ? ___', 'Tusi kal ki kita? ___', 'What did you do yesterday?', 'ਮੈਂ ਕੰਮ ਤੇ ਗਿਆ', 'mai kaam te gaya'),
    (v_seg, 7, 'ਤੁਸੀਂ ਕੱਲ੍ਹ ਕੀ ਕਰੋਗੇ? ___', 'Tusi kal ki karoge? ___', 'What will you do tomorrow?', 'ਮੈਂ ਪੰਜਾਬੀ ਦਾ ਅਭਿਆਸ ਕਰਾਂਗਾ', 'mai Punjabi da abhyaas karunga'),
    (v_seg, 8, 'ਕੀ ਤੁਸੀਂ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹੋ? ___', 'Ki tusi Punjabi bol sakde ho? ___', 'Can you speak Punjabi?', 'ਹਾਂ, ਮੈਂ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦਾ ਹਾਂ', 'haan, mai thorhi Punjabi bol sakda haa'),
    (v_seg, 9, 'ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਵਿੱਚ ਕੌਣ ਹੈ? ___', 'Tuhade parivar vich kaun hai? ___', 'Who is in your family?', 'ਮੇਰੇ ਮਾਪੇ ਅਤੇ ਭੈਣ', 'mere maape ate bhain'),
    (v_seg, 10, 'ਤੁਸੀਂ ਅਗਲੇ ਸਾਲ ਕੀ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ? ___', 'Tusi agle saal ki karna chahunde ho? ___', 'What do you want to do next year?', 'ਮੈਂ ਪੰਜਾਬ ਜਾਣਾ ਚਾਹੁੰਦਾ ਹਾਂ', 'mai Punjab jaana chahunda haa');

  -- Segment 12 — Presentation tips
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Presentation tips',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Timer","label":"Speak slowly","sublabel":"Take your time","color":"purple"},
        {"icon":"Smile","label":"Smile","sublabel":"Relax and enjoy","color":"teal"},
        {"icon":"Brain","label":"Don''t memorise","sublabel":"Know your story","color":"amber"},
        {"icon":"RefreshCw","label":"Keep going","sublabel":"Mistakes are fine","color":"coral"},
        {"icon":"PartyPopper","label":"Enjoy yourself","sublabel":"Celebrate your progress","color":"green"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Nobody is expecting perfection. The goal is to communicate confidently. If you forget something, simply continue.');

  -- Segment 13 — Course recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Course recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You''re ready","subheading":"Everything you need for Week 12"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You''ve learned enough Punjabi to introduce yourself, describe your life and hold a basic conversation. Week 12 is your opportunity to demonstrate everything you''ve achieved.');

  -- Segment 14 — Final preparation quiz (link mixed quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Final preparation quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Final preparation quiz"}'::jsonb,
    'quiz', 'Take the final preparation quiz — it mixes sentence structure, verb conjugation, continuous tense, ability, wants, questions, past tense and future tense from Weeks 1–10.'
  );

  -- Segment 15 — Presentation homework (complete draft, tutor review)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["Mic","Home"],"label":"Homework: practise your presentation","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Submit your complete Week 12 presentation draft below — one section per prompt. Romanised Punjabi is fine. Your tutor will review grammar, flow and confidence.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Introduction (name and greeting).', NULL, '(Open response — tutor reviews grammar, pronunciation notes, flow and confidence)'),
    (v_seg, 2, 'Family.', NULL, '(Open response — e.g. Mera parivar ... hai.)'),
    (v_seg, 3, 'Home (where you live).', NULL, '(Open response — e.g. Main ... vich rehnda haa.)'),
    (v_seg, 4, 'Job or studies.', NULL, '(Open response — e.g. Mai ... vajon kaam karda haa.)'),
    (v_seg, 5, 'Hobbies.', NULL, '(Open response — e.g. Mainu ... pasand hai.)'),
    (v_seg, 6, 'Daily routine.', NULL, '(Open response — e.g. Mai subah ... karada haa.)'),
    (v_seg, 7, 'Why you''re learning Punjabi.', NULL, '(Open response — e.g. Main Punjabi is liye sikh raha haa ki ... )'),
    (v_seg, 8, 'One past event.', NULL, '(Open response — past tense sentence)'),
    (v_seg, 9, 'One future goal.', NULL, '(Open response — future tense sentence)'),
    (v_seg, 10, 'Closing sentence.', NULL, '(Open response — e.g. Dhannvaad / Thank you for listening.)');

  RAISE NOTICE 'Week 11 catch-up seed complete for lesson %', v_lesson_id;
END $$;
