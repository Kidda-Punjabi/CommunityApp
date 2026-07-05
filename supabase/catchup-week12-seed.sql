-- =============================================================================
-- Kidda — Week 12 (Final Presentation + Course Reflection) catch-up seed
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
    AND l.lesson_number = 12
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 12 not found.';
  END IF;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Welcome to your final week
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Welcome to your final week',
    'recap_banner', '{"icon":"PartyPopper","heading":"Congratulations!","subheading":"You''ve reached Week 12"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Over the last twelve weeks you''ve built a strong foundation in Punjabi. Today isn''t about learning new grammar—it''s about celebrating how far you''ve come and confidently using everything you''ve already learned.');

  -- Segment 2 — What to expect today
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'What to expect today',
    'icon_hero', '{"icons":["Presentation"],"label":"Presentation Day","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Today you''ll deliver a short presentation in Punjabi, answer a few simple follow-up questions, and support the other learners in your cohort. The focus is on communication, confidence and enjoying the experience.');

  -- Segment 3 — Presentation structure (reference)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Presentation structure',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"User","label":"Introduce yourself"},
        {"icon":"Users","label":"Your family"},
        {"icon":"Briefcase","label":"Your work or studies"},
        {"icon":"Heart","label":"Your hobbies"},
        {"icon":"Sun","label":"Your daily routine"},
        {"icon":"GraduationCap","label":"Why you''re learning Punjabi"},
        {"icon":"TrendingUp","label":"Your future goals"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Remember, your presentation doesn''t need difficult grammar. The strongest presentations are usually simple, natural and well practised.');

  -- Segment 4 — Before you begin
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Before you begin',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Timer","label":"Speak slowly","sublabel":"Take your time","color":"purple"},
        {"icon":"Pause","label":"Pause if needed","sublabel":"A breath is fine","color":"teal"},
        {"icon":"Smile","label":"Keep smiling","sublabel":"Relax and enjoy","color":"amber"},
        {"icon":"RefreshCw","label":"Don''t worry about mistakes","sublabel":"Keep going","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Nobody expects perfection. Even fluent speakers pause, forget words and correct themselves. Your goal is simply to communicate.');

  -- Segment 5 — Presentation checklist
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 5, 5, 'Presentation checklist',
    'icon_hero', '{"icons":["ClipboardCheck"],"label":"Final checklist","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Run through the checklist before you begin: Introduction. Family. Home. Work or studies. Hobbies. Daily routine. A past experience. Future plans. A closing sentence. If you can cover these, you''re ready.');

  -- Segment 6 — Deliver your presentation (text submission → tutor review)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Deliver your presentation',
    'activity_scene', '{"icons":["Mic"],"caption":"It''s your turn"}'::jsonb,
    'homework', v_lesson_id,
    'Deliver your presentation in Punjabi, then paste the written version below (or the notes you used while speaking). Romanised Punjabi is fine — your tutor will review it alongside your spoken presentation.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Your complete presentation (written version or speaking notes).', NULL, '(Open response — tutor reviews grammar, pronunciation notes, flow and confidence)');

  -- Segment 7 — Follow-up questions
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Follow-up questions',
    'activity_scene', '{"icons":["MessageCircleQuestion"],"caption":"Answer naturally"}'::jsonb,
    'fill_blank', 'Answer each follow-up question in Punjabi. Write your own response — exemplar answers show one possibility.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਤੁਸੀਂ ਕੀ ਕਰਦੇ ਹੋ? ___', 'Tusi ki karde ho? ___', 'What do you do?', 'ਮੈਂ ਅਧਿਆਪਕ ਹਾਂ', 'mai adhyaapak haa'),
    (v_seg, 2, 'ਤੁਸੀਂ ਪੰਜਾਬੀ ਕਿਉਂ ਸਿੱਖ ਰਹੇ ਹੋ? ___', 'Tusi Punjabi kiun sikh rahe ho? ___', 'Why are you learning Punjabi?', 'ਮੈਂ ਆਪਣੇ ਪਰਿਵਾਰ ਨਾਲ ਗੱਲ ਕਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ', 'mai apne parivar naal gall karna chahunda haa'),
    (v_seg, 3, 'ਤੁਹਾਡੇ ਸ਼ੌਕ ਕੀ ਹਨ? ___', 'Tuhade shauq ki han? ___', 'What are your hobbies?', 'ਮੈਨੂੰ ਪੜ੍ਹਨਾ ਪਸੰਦ ਹੈ', 'mainu parhna pasand hai'),
    (v_seg, 4, 'ਤੁਸੀਂ ਕੱਲ੍ਹ ਕੀ ਕੀਤਾ? ___', 'Tusi kal ki kita? ___', 'What did you do yesterday?', 'ਮੈਂ ਕੰਮ ਤੇ ਗਿਆ', 'mai kaam te gaya'),
    (v_seg, 5, 'ਤੁਸੀਂ ਕੱਲ੍ਹ ਕੀ ਕਰੋਗੇ? ___', 'Tusi kal ki karoge? ___', 'What will you do tomorrow?', 'ਮੈਂ ਪੰਜਾਬੀ ਦਾ ਅਭਿਆਸ ਕਰਾਂਗਾ', 'mai Punjabi da abhyaas karunga'),
    (v_seg, 6, 'ਤੁਸੀਂ ਕਿੱਥੇ ਰਹਿੰਦੇ ਹੋ? ___', 'Tusi kithhe rehnde ho? ___', 'Where do you live?', 'ਮੈਂ ਲੰਡਨ ਵਿਚ ਰਹਿੰਦਾ ਹਾਂ', 'mai London vich rehnda haa'),
    (v_seg, 7, 'ਕੀ ਤੁਸੀਂ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹੋ? ___', 'Ki tusi Punjabi bol sakde ho? ___', 'Can you speak Punjabi?', 'ਹਾਂ, ਮੈਂ ਥੋੜ੍ਹੀ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦਾ ਹਾਂ', 'haan, mai thorhi Punjabi bol sakda haa'),
    (v_seg, 8, 'ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਵਿੱਚ ਕੌਣ ਹੈ? ___', 'Tuhade parivar vich kaun hai? ___', 'Who is in your family?', 'ਮੇਰੇ ਮਾਪੇ ਅਤੇ ਭੈਣ', 'mere maape ate bhain'),
    (v_seg, 9, 'ਤੁਹਾਨੂੰ ਕੀ ਖਾਣਾ ਪਸੰਦ ਹੈ? ___', 'Tuhaanu ki khana pasand hai? ___', 'What do you enjoy eating?', 'ਮੈਨੂੰ ਦਾਲ ਚਾਵਲ ਪਸੰਦ ਹੈ', 'mainu daal chaaval pasand hai'),
    (v_seg, 10, 'ਤੁਸੀਂ ਅਗਲਾ ਕੀ ਸਿੱਖਣਾ ਚਾਹੁੰਦੇ ਹੋ? ___', 'Tusi agla ki sikhna chahunde ho? ___', 'What do you want to learn next?', 'ਮੈਂ ਹੋਰ ਪੰਜਾਬੀ ਗੱਲਾਂ ਸਿੱਖਣਾ ਚਾਹੁੰਦਾ ਹਾਂ', 'mai hor Punjabi gallan sikhna chahunda haa');

  -- Segment 8 — Listening to others
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Listening to others',
    'icon_hero', '{"icons":["Ear"],"label":"Be an active listener","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'While others are presenting, listen carefully. You''ll hear different vocabulary, sentence structures and ideas that can help improve your own Punjabi.');

  -- Segment 9 — Supporting your classmates
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Supporting your classmates',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"ThumbsUp","label":"Encourage","sublabel":"Cheer each other on","color":"purple"},
        {"icon":"Ear","label":"Listen","sublabel":"Give your full attention","color":"teal"},
        {"icon":"PartyPopper","label":"Celebrate","sublabel":"Every effort counts","color":"amber"},
        {"icon":"Lightbulb","label":"Learn","sublabel":"Notice new ideas","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Learning a language is easier together. Encourage your classmates and celebrate everyone''s progress, regardless of mistakes.');

  -- Segment 10 — Self-reflection
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 10, 10, 'Self-reflection',
    'activity_scene', '{"icons":["NotebookPen"],"caption":"Reflect on your journey"}'::jsonb,
    'fill_blank', 'Answer honestly in your own words — there are no wrong answers. Exemplars show the kind of response expected.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਮੇਰੀ ਸਭ ਤੋਂ ਵੱਡੀ ਉਪਲਬਧੀ ___ ਹੈ', 'Meri sab ton vaddi uplabhdhi ___ hai', 'What was your biggest achievement?', 'ਪਹਿਲੀ ਵਾਰ ਪੰਜਾਬੀ ਵਿੱਚ ਪੇਸ਼ਕਾਰੀ', 'presenting in Punjabi for the first time'),
    (v_seg, 2, 'ਸਭ ਤੋਂ ਮੁਸ਼ਕਲ ਵਿਸ਼ਾ ___ ਸੀ', 'Sab ton mushkil vishaa ___ si', 'What was the hardest topic?', 'ਭੂਤਕਾਲ', 'past tense'),
    (v_seg, 3, 'ਮੈਨੂੰ ਸਭ ਤੋਂ ਵੱਧ ___ ਪਸੰਦ ਆਇਆ', 'Mainu sab ton vadh ___ pasand aaya', 'Which lesson did you enjoy most?', 'Week 7 conversations', 'Week 7 conversations'),
    (v_seg, 4, 'ਮੈਨੂੰ ਸਭ ਤੋਂ ਵੱਧ ਗਰਵ ___ ਤੇ ਹੈ', 'Mainu sab ton vadh garv ___ te hai', 'What are you most proud of?', 'not giving up when it felt hard', 'not giving up when it felt hard'),
    (v_seg, 5, 'ਮੈਂ ਅਗਲਾ ___ ਸੁਧਾਰਨਾ ਚਾਹੁੰਦਾ ਹਾਂ', 'Mai agla ___ sudhaarna chahunda haa', 'What would you like to improve next?', 'speaking more fluently', 'speaking more fluently');

  -- Segment 11 — Looking back
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 11, 11, 'Looking back',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Hand","label":"Week 1 — First phrases","sublabel":"Core greetings","color":"purple"},
        {"icon":"BookOpen","label":"Week 3 — Verbs","sublabel":"How sentences work","color":"teal"},
        {"icon":"Sparkles","label":"Week 5 — Verbals","sublabel":"Activities as nouns","color":"amber"},
        {"icon":"MessagesSquare","label":"Week 7 — Conversations","sublabel":"Questions and description","color":"coral"},
        {"icon":"ClockArrowUp","label":"Week 9 — Future tense","sublabel":"Talking about plans","color":"green"},
        {"icon":"Presentation","label":"Week 12 — Presentation","sublabel":"You made it!","color":"purple"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Think about your first lesson compared with today. Twelve weeks ago you were learning basic greetings. Today you''re giving an entire presentation in Punjabi.');

  -- Segment 12 — What's next?
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'What''s next?',
    'icon_hero', '{"icons":["TrendingUp"],"label":"Keep improving","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Language learning doesn''t end today. Continue speaking with family, listening to Punjabi, reading simple content and practising regularly. Small amounts of practice every week make a huge difference.');

  -- Segment 13 — Course celebration
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Course celebration',
    'recap_banner', '{"icon":"Award","heading":"Congratulations!","subheading":"You''ve completed the Kidda Foundations Course"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You should be incredibly proud of the progress you''ve made. You''ve built a strong foundation that will allow you to continue developing your Punjabi with confidence.');

  -- Segment 14 — Course reflection (fill_blank, not a scored quiz)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Course reflection',
    'quiz_banner', '{"icon":"HeartHandshake","heading":"Before you finish..."}'::jsonb,
    'fill_blank', 'Rate your experience honestly — use a number (1–10), a short phrase, or a sentence. There are no wrong answers.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਪੰਜਾਬੀ ਬੋਲਣ ਦਾ ਵਿਸ਼ਵਾਸ: ___', 'Punjabi bolda da vishvaas: ___', 'Confidence speaking Punjabi', '7', '7'),
    (v_seg, 2, 'ਪੰਜਾਬੀ ਸਮਝਣ ਦਾ ਵਿਸ਼ਵਾਸ: ___', 'Punjabi samjhan da vishvaas: ___', 'Confidence understanding Punjabi', '6', '6'),
    (v_seg, 3, 'ਕੋਰਸ ਦਾ ਆਨੰਦ: ___', 'Course da aanand: ___', 'Enjoyment of the course', '9', '9'),
    (v_seg, 4, 'ਜਾਰੀ ਰੱਖਣ ਦੀ ਸੰਭਾਵਨਾ: ___', 'Jaari rakhhan di sanbhavna: ___', 'Likelihood of continuing', 'very likely', 'very likely');

  -- Segment 15 — Course feedback
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 15, 15, 'Course feedback',
    'icon_hero', '{"icons":["MessageSquareHeart"],"label":"Thank you","accentColor":"coral"}'::jsonb,
    'none',
    'Thank you for being part of Kidda. Please complete the course feedback form linked in your Week 12 lesson presentation — your feedback helps us improve the course for future learners.'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Thank you for being part of Kidda. Your feedback helps us improve the course for future learners. Open your Week 12 presentation slides and follow the link to the course feedback form before you finish.');

  RAISE NOTICE 'Week 12 catch-up seed complete for lesson %', v_lesson_id;
END $$;
