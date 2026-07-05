-- =============================================================================
-- Kidda — Foundational Course Lesson 4 (Reading Complete Punjabi Words) catch-up seed
-- Run after:
--   supabase/catchup-lesson-segments.sql
--   supabase/catchup-teaching-visuals.sql
--   supabase/catchup-week2-activities.sql
--   supabase/homework-submissions-text.sql
--   supabase/catchup-foundational-lesson1-seed.sql
--   supabase/catchup-foundational-lesson2-seed.sql
--   supabase/catchup-foundational-lesson3-seed.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID;
  v_master_deck_id UUID;
  v_simple_deck_id UUID;
  v_reading_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'foundational'
    AND l.lesson_number = 4
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Foundational lesson_number = 4 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  SELECT id INTO v_simple_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L4 - Simple words'
  LIMIT 1;

  IF v_simple_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L4 - Simple words',
      'First Punjabi words for Foundations Lesson 4 reading practice.'
    )
    RETURNING id INTO v_simple_deck_id;
  END IF;

  SELECT id INTO v_reading_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L4 - Reading practice'
  LIMIT 1;

  IF v_reading_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L4 - Reading practice',
      'Extended word list for Foundations Lesson 4 reading challenge.'
    )
    RETURNING id INTO v_reading_deck_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Reuse existing Gurmukhi-front cards from any deck, then fill gaps on L4 decks
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (v.gurmukhi)
    v_simple_deck_id,
    COALESCE(existing.front_text, v.gurmukhi),
    COALESCE(existing.back_text, v.back),
    COALESCE(existing.romanised, v.roman),
    COALESCE(existing.category, 'alphabet'),
    'Foundations L4 - Simple words',
    ARRAY['foundational', 'reading_word']::text[],
    COALESCE(existing.difficulty, 2)
  FROM (VALUES
    ('ਘਰ', 'ghar — home', 'ghar'),
    ('ਨਾਮ', 'naam — name', 'naam'),
    ('ਕਮ', 'kam — work', 'kam'),
    ('ਆਮ', 'aam — mango', 'aam'),
    ('ਪਾਣੀ', 'paani — water', 'paani'),
    ('ਕਿਤਾਬ', 'kitaab — book', 'kitaab'),
    ('ਕਲਮ', 'kalam — pen', 'kalam'),
    ('ਮਾਂ', 'maa — mother', 'maa'),
    ('ਬਾਬਾ', 'baba — grandfather', 'baba'),
    ('ਰੋਟੀ', 'roti — bread', 'roti')
  ) AS v(gurmukhi, back, roman)
  LEFT JOIN LATERAL (
    SELECT f.front_text, f.back_text, f.romanised, f.category, f.difficulty
    FROM public.flashcards f
    WHERE f.front_text = v.gurmukhi
       OR f.romanised = v.roman
       OR (v_master_deck_id IS NOT NULL AND f.deck_id = v_master_deck_id AND (
            f.back_text = v.gurmukhi
            OR f.romanised = v.roman
            OR (v.roman = 'ghar' AND f.front_text ILIKE 'home%')
            OR (v.roman = 'naam' AND f.front_text ILIKE 'name%')
            OR (v.roman = 'paani' AND f.front_text ILIKE '%water%')
            OR (v.roman = 'kitaab' AND f.front_text ILIKE '%book%')
            OR (v.roman = 'roti' AND f.front_text ILIKE '%bread%' OR f.front_text ILIKE '%roti%')
            OR (v.roman = 'maa' AND f.front_text ILIKE 'mother%')
          ))
    ORDER BY CASE WHEN f.front_text = v.gurmukhi THEN 0 ELSE 1 END, f.created_at NULLS LAST
    LIMIT 1
  ) AS existing ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards w
    WHERE w.deck_id = v_simple_deck_id AND w.front_text = v.gurmukhi
  );

  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (v.gurmukhi)
    v_reading_deck_id,
    COALESCE(existing.front_text, v.gurmukhi),
    COALESCE(existing.back_text, v.back),
    COALESCE(existing.romanised, v.roman),
    COALESCE(existing.category, 'alphabet'),
    'Foundations L4 - Reading practice',
    ARRAY['foundational', 'reading_word']::text[],
    COALESCE(existing.difficulty, 2)
  FROM (VALUES
    ('ਘਰ', 'ghar — home', 'ghar'),
    ('ਨਾਮ', 'naam — name', 'naam'),
    ('ਕਮ', 'kam — work', 'kam'),
    ('ਆਮ', 'aam — mango', 'aam'),
    ('ਪਾਣੀ', 'paani — water', 'paani'),
    ('ਕਿਤਾਬ', 'kitaab — book', 'kitaab'),
    ('ਕਲਮ', 'kalam — pen', 'kalam'),
    ('ਮਾਂ', 'maa — mother', 'maa'),
    ('ਬਾਬਾ', 'baba — grandfather', 'baba'),
    ('ਰੋਟੀ', 'roti — bread', 'roti'),
    ('ਦੁੱਧ', 'dudh — milk', 'dudh'),
    ('ਪੰਜਾਬੀ', 'Punjabi — Punjabi language', 'Punjabi'),
    ('ਕੁੜੀ', 'kuri — girl', 'kuri'),
    ('ਮੁੰਡਾ', 'munda — boy', 'munda'),
    ('ਪਰਿਵਾਰ', 'parivar — family', 'parivar')
  ) AS v(gurmukhi, back, roman)
  LEFT JOIN LATERAL (
    SELECT f.front_text, f.back_text, f.romanised, f.category, f.difficulty
    FROM public.flashcards f
    WHERE f.front_text = v.gurmukhi
       OR f.romanised = v.roman
       OR (v_master_deck_id IS NOT NULL AND f.deck_id = v_master_deck_id AND (
            f.back_text = v.gurmukhi
            OR f.romanised = v.roman
            OR (v.roman = 'dudh' AND f.front_text ILIKE '%milk%')
            OR (v.roman = 'Punjabi' AND f.front_text ILIKE '%punjabi%')
            OR (v.roman = 'parivar' AND f.front_text ILIKE '%family%')
            OR (v.roman = 'kuri' AND f.front_text ILIKE '%girl%')
            OR (v.roman = 'munda' AND f.front_text ILIKE '%boy%')
          ))
    ORDER BY CASE WHEN f.front_text = v.gurmukhi THEN 0 ELSE 1 END, f.created_at NULLS LAST
    LIMIT 1
  ) AS existing ON true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards w
    WHERE w.deck_id = v_reading_deck_id AND w.front_text = v.gurmukhi
  );

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Lesson 3 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Lesson 3 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last lesson","subheading":"Independent vowels + Matras"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last lesson you completed the Punjabi writing system by learning independent vowels and matras. You can now recognise every letter and every vowel sound. Today we''ll combine everything you''ve learned to begin reading real Punjabi words.');

  -- Segment 2 — From letters to words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'From letters to words',
    'icon_hero', '{"icons":["BookOpenCheck"],"label":"Reading Punjabi","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Reading isn''t about memorising thousands of words. It''s about recognising familiar letter patterns. Once you can decode sounds confidently, every new Punjabi word becomes much easier to learn.');

  -- Segment 3 — How to read any Punjabi word
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'How to read any Punjabi word',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Search","label":"Find the consonants","sublabel":"Identify each base letter","color":"purple"},
        {"icon":"PenTool","label":"Find the matras","sublabel":"Spot the vowel markers","color":"teal"},
        {"icon":"Type","label":"Read each syllable","sublabel":"Sound out step by step","color":"amber"},
        {"icon":"Sparkles","label":"Blend the sounds","sublabel":"Say the whole word","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Every Punjabi word can be read using the same four-step process. First identify the consonants, then look for the matras, pronounce each syllable, and finally blend the sounds together.');

  -- Segment 4 — Reading strategy
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Reading strategy',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"CircleOff","label":"1. Don''t guess."},
        {"icon":"Type","label":"2. Read one sound at a time."},
        {"icon":"Timer","label":"3. Blend slowly."},
        {"icon":"RefreshCw","label":"4. Read the whole word again naturally."}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Strong readers don''t rush. Reading slowly and accurately is far more valuable than reading quickly.');

  -- Segment 5 — Reading simple words (flashcards)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Reading simple words',
    'activity_scene', '{"icons":["BookOpen"],"caption":"Your first Punjabi words"}'::jsonb,
    'flashcard_set', v_simple_deck_id,
    'Read each word aloud before flipping the card to reveal the romanised pronunciation.'
  ) RETURNING id INTO v_seg;

  -- Segment 6 — Spotting familiar patterns
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Spotting familiar patterns',
    'icon_hero', '{"icons":["Search"],"label":"Recognising patterns","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You''ll notice many words share the same endings, the same matras or the same consonant combinations. Recognising these patterns is what eventually makes reading feel automatic.');

  -- Segment 7 — Reading challenge (fill blank)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Reading challenge',
    'activity_scene', '{"icons":["Languages"],"caption":"Can you read it?"}'::jsonb,
    'fill_blank', 'Read each Punjabi word and type the romanised pronunciation. Minor spelling variations are accepted.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਘਰ', 'ghar', 'Read this word aloud, then type the pronunciation.', NULL, 'ghar'),
    (v_seg, 2, 'ਪਾਣੀ', 'paani', 'Read this word aloud, then type the pronunciation.', NULL, 'paani'),
    (v_seg, 3, 'ਕਿਤਾਬ', 'kitaab', 'Read this word aloud, then type the pronunciation.', NULL, 'kitaab'),
    (v_seg, 4, 'ਕਲਮ', 'kalam', 'Read this word aloud, then type the pronunciation.', NULL, 'kalam'),
    (v_seg, 5, 'ਮਾਂ', 'maa', 'Read this word aloud, then type the pronunciation.', NULL, 'maa'),
    (v_seg, 6, 'ਬਾਬਾ', 'baba', 'Read this word aloud, then type the pronunciation.', NULL, 'baba'),
    (v_seg, 7, 'ਰੋਟੀ', 'roti', 'Read this word aloud, then type the pronunciation.', NULL, 'roti');

  -- Segment 8 — Longer words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Longer words',
    'icon_hero', '{"icons":["ArrowRight"],"label":"Reading multiple syllables","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Longer words aren''t actually harder—they simply contain more syllables. Read each syllable separately before blending them together. Try: ਪੰਜਾਬੀ (Punjabi), ਪਰਿਵਾਰ (parivar — family), ਅਧਿਆਪਕ (adhyaapak — teacher), ਸਕੂਲ (school).');

  -- Segment 9 — Word building
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Word building',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Type","label":"ਕ"},
        {"icon":"ArrowDown","label":"↓"},
        {"icon":"Type","label":"ਕਾ"},
        {"icon":"ArrowDown","label":"↓"},
        {"icon":"Type","label":"ਕਲਾ (art)"},
        {"icon":"ArrowDown","label":"↓"},
        {"icon":"Type","label":"ਕਲਮ (pen)"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Notice how every word is simply a collection of sounds you''ve already learned. Nothing new is being introduced—you''re just combining familiar building blocks.');

  -- Segment 10 — Reading practice (flashcards)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 10, 10, 'Reading practice',
    'activity_scene', '{"icons":["Eye"],"caption":"Read without help"}'::jsonb,
    'flashcard_set', v_reading_deck_id,
    'Attempt to read each word aloud before flipping to check the romanised spelling.'
  ) RETURNING id INTO v_seg;

  -- Segment 11 — Mixed recognition
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Mixed recognition',
    'activity_scene', '{"icons":["Brain"],"caption":"Everything together"}'::jsonb,
    'fill_blank', 'Answer using Gurmukhi or romanised — both are accepted where noted.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, 'ਕੀ — matra?', 'kee — matra?', 'What matra is in ਕੀ?', 'ੀ', 'Bihari'),
    (v_seg, 2, 'ਗਾ — consonant?', 'gaa — consonant?', 'Name the consonant in ਗਾ.', 'ਗ', 'Gagga'),
    (v_seg, 3, 'ਘਰ — read it', 'ghar — read it', 'Read the word ਘਰ (romanised).', NULL, 'ghar'),
    (v_seg, 4, 'ਪਾਣੀ — first syllable', 'paani — first syllable', 'What is the first syllable sound of ਪਾਣੀ?', 'ਪਾ', 'paa'),
    (v_seg, 5, 'ਕਿਤਾਬ — last sound', 'kitaab — last sound', 'What is the last syllable sound of ਕਿਤਾਬ?', 'aab', 'aab');

  -- Segment 12 — Preparing for the Beginner Course
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Preparing for the Beginner Course',
    'icon_hero', '{"icons":["GraduationCap"],"label":"You''re ready","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You''ve now learned every letter, every vowel and how Punjabi words are constructed. This means you won''t need to memorise pronunciations throughout the Beginner Course—you''ll be able to read them yourself.');

  -- Segment 13 — Course recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Course recap',
    'recap_banner', '{"icon":"Award","heading":"You can now...","subheading":"Read basic Punjabi confidently"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You now recognise the entire Gurmukhi alphabet, understand consonants, vowels and matras, and can begin reading simple Punjabi words independently. That''s an enormous milestone.');

  -- Segment 14 — Final Foundations Quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Final Foundations Quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Foundations Course Final Quiz"}'::jsonb,
    'quiz', 'Take the Foundations final quiz — it covers all four lessons: alphabet, consonant families, vowels, matras and reading complete words.'
  );

  -- Segment 15 — Graduation & Homework
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Graduation & Homework',
    'icon_hero', '{"icons":["Award","BookOpen"],"label":"Congratulations!","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Congratulations on completing the Kidda Foundations Course! Practise reading every word from today''s lesson aloud three times, then answer the four questions below.',
    'text'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Congratulations on completing the Kidda Foundations Course! Most learners begin by seeing Punjabi as a collection of unfamiliar symbols. Today you''re reading real Punjabi words. That''s something to be incredibly proud of.');

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Practise reading these words aloud three times and write their romanised forms: ਘਰ ਨਾਮ ਕਮ ਆਮ ਪਾਣੀ ਕਿਤਾਬ ਕਲਮ ਮਾਂ ਬਾਬਾ ਰੋਟੀ ਦੁੱਧ ਪੰਜਾਬੀ ਕੁੜੀ ਮੁੰਡਾ ਪਰਿਵਾਰ', NULL, 'ghar, naam, kam, aam, paani, kitaab, kalam, maa, baba, roti, dudh, Punjabi, kuri, munda, parivar'),
    (v_seg, 2, 'Which consonant family do you find easiest?', NULL, '(Open response — e.g. Labial, Dental, Velar)'),
    (v_seg, 3, 'Which matra do you still need to practise?', NULL, '(Open response — e.g. ੈ Dulavan / ai matra)'),
    (v_seg, 4, 'Read ten Punjabi words aloud and write their romanised pronunciation.', NULL, '(Open response — list ten words with romanised forms)'),
    (v_seg, 5, 'Which word was the hardest to read, and why?', NULL, '(Open response — e.g. ਪੰਜਾਬੀ because of multiple syllables)');

  RAISE NOTICE 'Foundational Lesson 4 catch-up seed complete for lesson %', v_lesson_id;
END $$;
