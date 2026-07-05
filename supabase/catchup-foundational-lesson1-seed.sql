-- =============================================================================
-- Kidda — Foundational Course Lesson 1 (Learning the Punjabi Script) catch-up seed
-- Run after:
--   supabase/catchup-lesson-segments.sql
--   supabase/catchup-teaching-visuals.sql
--   supabase/catchup-week2-activities.sql
--   supabase/homework-submissions-text.sql
--   supabase/flashcard-sets.sql
--   supabase/flashcards-master.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID;
  v_alphabet_deck_id UUID;
  v_line1_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'foundational'
    AND l.lesson_number = 1
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Foundational lesson_number = 1 not found.';
  END IF;

  -- Master alphabet deck (idempotent)
  SELECT id INTO v_alphabet_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations - Gurmukhi Alphabet'
  LIMIT 1;

  IF v_alphabet_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations - Gurmukhi Alphabet',
      'Gurmukhi letters for the Kidda Foundations reading course.'
    )
    RETURNING id INTO v_alphabet_deck_id;
  END IF;

  -- Line 1 practice deck (idempotent)
  SELECT id INTO v_line1_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L1 - Line 1'
  LIMIT 1;

  IF v_line1_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L1 - Line 1',
      'First five Gurmukhi symbols: Oora, Airaa, Eeree, Sassa, Hahaa.'
    )
    RETURNING id INTO v_line1_deck_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Alphabet flashcards on master deck (create only if missing)
  -- front_text = Gurmukhi, back_text = name + pronunciation, romanised = name
  -- topic_tags encode sound group / line
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (
    deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty
  )
  SELECT v_alphabet_deck_id, v.gurmukhi, v.back, v.roman, 'alphabet', 'Foundations - Gurmukhi Alphabet', v.tags, v.diff
  FROM (VALUES
    ('ੳ', 'Oora — vowel carrier (no sound alone)', 'Oora', ARRAY['foundational', 'line_1', 'vowel_carrier']::text[], 1),
    ('ਅ', 'Airaa — a (as in apple)', 'Airaa', ARRAY['foundational', 'line_1', 'independent_vowel']::text[], 1),
    ('ੲ', 'Eeree — vowel carrier (no sound alone)', 'Eeree', ARRAY['foundational', 'line_1', 'vowel_carrier']::text[], 1),
    ('ਸ', 'Sassa — s (as in sun)', 'Sassa', ARRAY['foundational', 'line_1', 'consonant']::text[], 1),
    ('ਹ', 'Hahaa — h (as in house)', 'Hahaa', ARRAY['foundational', 'line_1', 'consonant']::text[], 1),
    ('ਕ', 'Kakka — k (velar)', 'Kakka', ARRAY['foundational', 'velar', 'consonant']::text[], 2),
    ('ਖ', 'Khakkha — kh (velar)', 'Khakkha', ARRAY['foundational', 'velar', 'consonant']::text[], 2),
    ('ਗ', 'Gagga — g (velar)', 'Gagga', ARRAY['foundational', 'velar', 'consonant']::text[], 2),
    ('ਘ', 'Ghagga — gh (velar)', 'Ghagga', ARRAY['foundational', 'velar', 'consonant']::text[], 2),
    ('ਙ', 'Nga — ng (velar)', 'Nga', ARRAY['foundational', 'velar', 'consonant']::text[], 2),
    ('ਚ', 'Chacha — ch (palatal)', 'Chacha', ARRAY['foundational', 'palatal', 'consonant']::text[], 2),
    ('ਛ', 'Chhachha — chh (palatal)', 'Chhachha', ARRAY['foundational', 'palatal', 'consonant']::text[], 2),
    ('ਜ', 'Jajja — j (palatal)', 'Jajja', ARRAY['foundational', 'palatal', 'consonant']::text[], 2),
    ('ਝ', 'Jhajja — jh (palatal)', 'Jhajja', ARRAY['foundational', 'palatal', 'consonant']::text[], 2),
    ('ਞ', 'Nyana — ny (palatal)', 'Nyana', ARRAY['foundational', 'palatal', 'consonant']::text[], 2),
    ('ਟ', 'Tainka — tt (retroflex)', 'Tainka', ARRAY['foundational', 'retroflex', 'consonant']::text[], 2),
    ('ਠ', 'Thhadda — tth (retroflex)', 'Thhadda', ARRAY['foundational', 'retroflex', 'consonant']::text[], 2),
    ('ਡ', 'Ddadda — dd (retroflex)', 'Ddadda', ARRAY['foundational', 'retroflex', 'consonant']::text[], 2),
    ('ਢ', 'Ddhadda — ddh (retroflex)', 'Ddhadda', ARRAY['foundational', 'retroflex', 'consonant']::text[], 2),
    ('ਣ', 'Nana — nn (retroflex)', 'Nana', ARRAY['foundational', 'retroflex', 'consonant']::text[], 2)
  ) AS v(gurmukhi, back, roman, tags, diff)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_alphabet_deck_id
      AND (
        f.front_text = v.gurmukhi
        OR f.romanised = v.roman
        OR (v.roman = 'Airaa' AND f.romanised IN ('Airaa', 'Aira', 'Aara'))
        OR (v.roman = 'Ddadda' AND f.romanised IN ('Ddadda', 'Dadda'))
      )
  );

  -- Populate Line 1 deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (f.front_text)
    v_line1_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'alphabet'),
    'Foundations L1 - Line 1',
    f.topic_tags,
    f.difficulty
  FROM public.flashcards f
  WHERE f.deck_id = v_alphabet_deck_id
    AND f.front_text IN ('ੳ', 'ਅ', 'ੲ', 'ਸ', 'ਹ')
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_line1_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Welcome to the Foundations Course
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Welcome to the Foundations Course',
    'icon_hero', '{"icons":["Languages"],"label":"Learning Gurmukhi","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Welcome to the Kidda Foundations Course. Before speaking Punjabi confidently, it''s worth understanding how the Punjabi writing system works. Over the next four lessons you''ll learn to recognise every letter, understand how Punjabi sounds are organised, and begin reading real Punjabi words.');

  -- Segment 2 — How this course works
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'How this course works',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"BookOpen","label":"Session 1 – Script","sublabel":"First letters and groups","color":"purple"},
        {"icon":"Type","label":"Session 2 – Remaining consonants","sublabel":"Complete the alphabet","color":"teal"},
        {"icon":"CircleDot","label":"Session 3 – Vowels & Matras","sublabel":"Vowel sounds and markers","color":"amber"},
        {"icon":"Sparkles","label":"Session 4 – Reading words","sublabel":"Put it together","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Each lesson builds directly on the previous one. Don''t worry about memorising everything immediately. By the end of the course you''ll naturally recognise the script through repeated exposure.');

  -- Segment 3 — What is Gurmukhi?
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'What is Gurmukhi?',
    'icon_hero', '{"icons":["BookOpen"],"label":"The Punjabi writing system","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi is written using the Gurmukhi script. Unlike English, the letters are organised logically according to where the sound is made inside your mouth. This makes the alphabet much easier to learn than it first appears.');

  -- Segment 4 — The three building blocks
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'The three building blocks',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Type","label":"Consonants","sublabel":"ਕ ਖ ਗ ਘ…","color":"purple"},
        {"icon":"Circle","label":"Independent vowels","sublabel":"ਅ ਆ ਇ ਈ…","color":"teal"},
        {"icon":"Minus","label":"Matras","sublabel":"ਾ ਿ ੀ ੁ ੂ…","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Everything you read in Punjabi is built from just three ingredients: consonants, independent vowels and vowel markers called matras. Once you understand these three parts, reading becomes much easier.');

  -- Segment 5 — The complete overview (reference chart)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 5, 5, 'The complete overview',
    'conjugation_table',
    '{
      "title": "Gurmukhi overview — consonants, independent vowels and matras",
      "columns": ["Part", "Examples", "What it does"],
      "rows": [
        {"Part":"Consonants","Examples":"ਕ ਖ ਗ ਘ ਙ ਚ ਛ ਜ ਝ ਞ ਟ ਠ ਡ ਢ ਣ…","What it does":"Base sounds — grouped in five mouth positions"},
        {"Part":"Independent vowels","Examples":"ਅ ਆ ਇ ਈ ਉ ਊ ਏ ਐ ਓ ਔ","What it does":"Standalone vowel sounds"},
        {"Part":"Matras","Examples":"ਾ ਿ ੀ ੁ ੂ ੇ ੈ ੋ ੌ","What it does":"Vowel marks attached to consonants"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Before learning individual letters, take a moment to look at the complete script. Don''t worry about remembering everything yet—this is simply to become familiar with how Punjabi writing looks.');

  -- Segment 6 — The first line of the alphabet
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'The first line of the alphabet',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Circle","label":"ੳ — Oora"},
        {"icon":"Circle","label":"ਅ — Airaa"},
        {"icon":"Circle","label":"ੲ — Eeree"},
        {"icon":"Circle","label":"ਸ — Sassa"},
        {"icon":"Circle","label":"ਹ — Hahaa"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'We''ll begin with the very first five symbols. Notice that Oora and Eeree don''t have sounds on their own. They mainly act as carriers for vowel sounds later in the course.');

  -- Segment 7 — Practise: Line 1 (flashcards)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Practise: Line 1',
    'activity_scene', '{"icons":["BookOpen"],"caption":"Recognise the first five letters"}'::jsonb,
    'flashcard_set', v_line1_deck_id,
    'Practise the first five symbols in both directions: Gurmukhi → romanised name, and romanised name → Gurmukhi.'
  ) RETURNING id INTO v_seg;

  -- Segment 8 — How the alphabet is organised
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'How the alphabet is organised',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"ArrowUp","label":"Velar","sublabel":"Back of the mouth","color":"purple"},
        {"icon":"Minus","label":"Palatal","sublabel":"Middle of the tongue","color":"teal"},
        {"icon":"RotateCcw","label":"Retroflex","sublabel":"Tongue curls back","color":"amber"},
        {"icon":"Smile","label":"Dental","sublabel":"Tongue touches teeth","color":"coral"},
        {"icon":"Circle","label":"Labial","sublabel":"Lips","color":"green"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'The remaining letters aren''t random. They''re grouped according to where the sound is made in your mouth. This is one of the biggest advantages of learning Gurmukhi.');

  -- Segment 9 — Understanding the five sound groups
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Understanding the five sound groups',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"ArrowUp","label":"Velar → back of the mouth"},
        {"icon":"Minus","label":"Palatal → middle of the tongue"},
        {"icon":"RotateCcw","label":"Retroflex → tongue curls back"},
        {"icon":"Smile","label":"Dental → tongue touches teeth"},
        {"icon":"Circle","label":"Labial → lips"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Instead of memorising individual letters, think of the alphabet as five families. Every family shares a similar mouth position.');

  -- Segment 10 — The first three rows
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'The first three rows',
    'icon_hero', '{"icons":["Type"],"label":"Velar, Palatal & Retroflex","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Today you''ll begin recognising the first three rows of consonants. Velar: ਕ ਖ ਗ ਘ ਙ. Palatal: ਚ ਛ ਜ ਝ ਞ. Retroflex: ਟ ਠ ਡ ਢ ਣ. Don''t worry about perfect pronunciation yet. Your goal is simply to become familiar with how they look and sound.');

  -- Segment 11 — Alphabet recognition (fill blank)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Alphabet recognition',
    'activity_scene', '{"icons":["Languages"],"caption":"Identify the letters"}'::jsonb,
    'fill_blank', 'Type the Gurmukhi letter or its romanised name. Both are accepted.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, '___', '___', 'Which letter makes the "k" sound?', 'ਕ', 'Kakka'),
    (v_seg, 2, '___', '___', 'Which letter is Gagga?', 'ਗ', 'Gagga'),
    (v_seg, 3, '___', '___', 'Which letter is Chhachha?', 'ਛ', 'Chhachha'),
    (v_seg, 4, '___', '___', 'Which letter is Ddadda?', 'ਡ', 'Ddadda'),
    (v_seg, 5, '___', '___', 'Which letter is Airaa?', 'ਅ', 'Airaa');

  -- Segment 12 — Speaking practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Speaking practice',
    'icon_hero', '{"icons":["Mic"],"label":"Say the sounds aloud","accentColor":"coral"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Reading silently isn''t enough. Say each sound aloud, even if you''re unsure. Building mouth memory now makes pronunciation much easier later. Repeat the velar row: ਕ ਖ ਗ ਘ ਙ. The palatal row: ਚ ਛ ਜ ਝ ਞ. The retroflex row: ਟ ਠ ਡ ਢ ਣ.');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Recognise the foundations of Gurmukhi"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You now understand how the Punjabi script is organised, recognise the first five symbols, and know how the consonants are grouped into sound families.');

  -- Segment 14 — Lesson 1 quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Lesson 1 quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Foundations Lesson 1 Quiz"}'::jsonb,
    'quiz', 'Take the Foundations Lesson 1 quiz — identify line 1 letters, match sound groups and recognise consonants by name.'
  );

  -- Segment 15 — Homework (text submission)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: practise the alphabet","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Write each letter, note its name and sound group where relevant, then answer the reflection questions. Gurmukhi or romanised is fine — your tutor will review your written work.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Write and name: ੳ (Oora)', 'ੳ', 'Oora — vowel carrier'),
    (v_seg, 2, 'Write and name: ਅ (Airaa)', 'ਅ', 'Airaa — a sound'),
    (v_seg, 3, 'Write and name: ੲ (Eeree)', 'ੲ', 'Eeree — vowel carrier'),
    (v_seg, 4, 'Write and name: ਸ (Sassa)', 'ਸ', 'Sassa — s sound'),
    (v_seg, 5, 'Write and name: ਹ (Hahaa)', 'ਹ', 'Hahaa — h sound'),
    (v_seg, 6, 'Write the velar row: ਕ ਖ ਗ ਘ ਙ', 'ਕ ਖ ਗ ਘ ਙ', 'Kakka Khakkha Gagga Ghagga Nga'),
    (v_seg, 7, 'Write the palatal row: ਚ ਛ ਜ ਝ ਞ', 'ਚ ਛ ਜ ਝ ਞ', 'Chacha Chhachha Jajja Jhajja Nyana'),
    (v_seg, 8, 'Write the retroflex row: ਟ ਠ ਡ ਢ ਣ', 'ਟ ਠ ਡ ਢ ਣ', 'Tainka Thhadda Ddadda Ddhadda Nana'),
    (v_seg, 9, 'Which group is ਕ in?', NULL, 'Velar'),
    (v_seg, 10, 'Which group is ਟ in?', NULL, 'Retroflex'),
    (v_seg, 11, 'Which letters have no sound on their own?', 'ੳ ੲ', 'Oora and Eeree (ੳ and ੲ)');

  RAISE NOTICE 'Foundational Lesson 1 catch-up seed complete for lesson %', v_lesson_id;
END $$;
