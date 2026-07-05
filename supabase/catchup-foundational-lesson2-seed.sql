-- =============================================================================
-- Kidda — Foundational Course Lesson 2 (Completing the Punjabi Consonants) catch-up seed
-- Run after:
--   supabase/catchup-lesson-segments.sql
--   supabase/catchup-teaching-visuals.sql
--   supabase/catchup-week2-activities.sql
--   supabase/homework-submissions-text.sql
--   supabase/catchup-foundational-lesson1-seed.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID;
  v_alphabet_deck_id UUID;
  v_dental_deck_id UUID;
  v_labial_deck_id UUID;
  v_reading_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'foundational'
    AND l.lesson_number = 2
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Foundational lesson_number = 2 not found.';
  END IF;

  SELECT id INTO v_alphabet_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations - Gurmukhi Alphabet'
  LIMIT 1;

  IF v_alphabet_deck_id IS NULL THEN
    RAISE EXCEPTION 'Foundations - Gurmukhi Alphabet deck not found — run catchup-foundational-lesson1-seed.sql first.';
  END IF;

  -- Dedicated practice decks (idempotent)
  SELECT id INTO v_dental_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L2 - Dental row'
  LIMIT 1;

  IF v_dental_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES ('Foundations L2 - Dental row', 'Dental consonants: Tatta, Thattha, Dadda, Dhadda, Nanna.')
    RETURNING id INTO v_dental_deck_id;
  END IF;

  SELECT id INTO v_labial_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L2 - Labial row'
  LIMIT 1;

  IF v_labial_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES ('Foundations L2 - Labial row', 'Labial consonants: Pappa, Phappa, Babba, Bhabba, Mamma.')
    RETURNING id INTO v_labial_deck_id;
  END IF;

  SELECT id INTO v_reading_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L2 - Consonant recognition'
  LIMIT 1;

  IF v_reading_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L2 - Consonant recognition',
      'All Gurmukhi consonants for recognition practice (Lessons 1–2).'
    )
    RETURNING id INTO v_reading_deck_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- New consonant flashcards on master deck (create only if missing)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (
    deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty
  )
  SELECT v_alphabet_deck_id, v.gurmukhi, v.back, v.roman, 'alphabet', 'Foundations - Gurmukhi Alphabet', v.tags, v.diff
  FROM (VALUES
    ('ਤ', 'Tatta — t (dental)', 'Tatta', ARRAY['foundational', 'dental', 'consonant']::text[], 2),
    ('ਥ', 'Thattha — th (dental)', 'Thattha', ARRAY['foundational', 'dental', 'consonant']::text[], 2),
    ('ਦ', 'Dadda — d (dental)', 'Dadda', ARRAY['foundational', 'dental', 'consonant']::text[], 2),
    ('ਧ', 'Dhadda — dh (dental)', 'Dhadda', ARRAY['foundational', 'dental', 'consonant']::text[], 2),
    ('ਨ', 'Nanna — n (dental)', 'Nanna', ARRAY['foundational', 'dental', 'consonant']::text[], 2),
    ('ਪ', 'Pappa — p (labial)', 'Pappa', ARRAY['foundational', 'labial', 'consonant']::text[], 2),
    ('ਫ', 'Phappa — ph (labial)', 'Phappa', ARRAY['foundational', 'labial', 'consonant']::text[], 2),
    ('ਬ', 'Babba — b (labial)', 'Babba', ARRAY['foundational', 'labial', 'consonant']::text[], 2),
    ('ਭ', 'Bhabba — bh (labial)', 'Bhabba', ARRAY['foundational', 'labial', 'consonant']::text[], 2),
    ('ਮ', 'Mamma — m (labial)', 'Mamma', ARRAY['foundational', 'labial', 'consonant']::text[], 2),
    ('ਯ', 'Yayya — y', 'Yayya', ARRAY['foundational', 'semivowel', 'consonant']::text[], 2),
    ('ਰ', 'Rara — r', 'Rara', ARRAY['foundational', 'semivowel', 'consonant']::text[], 2),
    ('ਲ', 'Lalla — l', 'Lalla', ARRAY['foundational', 'semivowel', 'consonant']::text[], 2),
    ('ਵ', 'Vava — v', 'Vava', ARRAY['foundational', 'semivowel', 'consonant']::text[], 2),
    ('ੜ', 'Rrarra — rolled r', 'Rrarra', ARRAY['foundational', 'semivowel', 'consonant']::text[], 3),
    ('ਸ਼', 'Shasha — sh (borrowed)', 'Shasha', ARRAY['foundational', 'additional', 'consonant']::text[], 3),
    ('ਖ਼', 'Khha — kh (Persian/Arabic)', 'Khha', ARRAY['foundational', 'additional', 'consonant']::text[], 3),
    ('ਗ਼', 'Ghha — gh (Persian/Arabic)', 'Ghha', ARRAY['foundational', 'additional', 'consonant']::text[], 3),
    ('ਜ਼', 'Zza — z (borrowed)', 'Zza', ARRAY['foundational', 'additional', 'consonant']::text[], 3),
    ('ਫ਼', 'Fafa — f (borrowed)', 'Fafa', ARRAY['foundational', 'additional', 'consonant']::text[], 3),
    ('ਲ਼', 'Llla — ll (rare)', 'Llla', ARRAY['foundational', 'additional', 'consonant']::text[], 3)
  ) AS v(gurmukhi, back, roman, tags, diff)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_alphabet_deck_id
      AND (
        f.front_text = v.gurmukhi
        OR f.romanised = v.roman
        OR (v.roman = 'Dadda' AND f.romanised IN ('Dadda', 'Ddadda') AND f.front_text = 'ਦ')
        OR (v.roman = 'Nanna' AND f.romanised IN ('Nanna', 'Nana'))
        OR (v.roman = 'Babba' AND f.romanised IN ('Babba', 'Bappa'))
      )
  );

  -- Populate dental deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (f.front_text)
    v_dental_deck_id, f.front_text, f.back_text, f.romanised,
    COALESCE(f.category, 'alphabet'), 'Foundations L2 - Dental row', f.topic_tags, f.difficulty
  FROM public.flashcards f
  WHERE f.deck_id = v_alphabet_deck_id
    AND f.front_text IN ('ਤ', 'ਥ', 'ਦ', 'ਧ', 'ਨ')
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_dental_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  -- Populate labial deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (f.front_text)
    v_labial_deck_id, f.front_text, f.back_text, f.romanised,
    COALESCE(f.category, 'alphabet'), 'Foundations L2 - Labial row', f.topic_tags, f.difficulty
  FROM public.flashcards f
  WHERE f.deck_id = v_alphabet_deck_id
    AND f.front_text IN ('ਪ', 'ਫ', 'ਬ', 'ਭ', 'ਮ')
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_labial_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  -- Populate reading challenge deck — all consonants from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (f.front_text)
    v_reading_deck_id, f.front_text, f.back_text, f.romanised,
    COALESCE(f.category, 'alphabet'), 'Foundations L2 - Consonant recognition', f.topic_tags, f.difficulty
  FROM public.flashcards f
  WHERE f.deck_id = v_alphabet_deck_id
    AND f.category = 'alphabet'
    AND f.topic_tags && ARRAY['consonant']::text[]
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_reading_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Lesson 1 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Lesson 1 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last lesson","subheading":"The foundations of Gurmukhi"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last lesson you learned how the Punjabi alphabet is organised, recognised the first symbols of Gurmukhi and became familiar with the first three consonant families. Today we''ll complete the alphabet and begin recognising every Punjabi consonant.');

  -- Segment 2 — The alphabet is almost complete
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'The alphabet is almost complete',
    'icon_hero', '{"icons":["Type"],"label":"Completing the consonants","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Today you''ll learn the remaining consonant families. By the end of this lesson you''ll recognise every standard Punjabi consonant, putting you in a great position to begin reading real words.');

  -- Segment 3 — Quick review
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Quick review',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"ArrowUp","label":"Velar","sublabel":"ਕ ਖ ਗ ਘ ਙ","color":"purple"},
        {"icon":"Minus","label":"Palatal","sublabel":"ਚ ਛ ਜ ਝ ਞ","color":"teal"},
        {"icon":"RotateCcw","label":"Retroflex","sublabel":"ਟ ਠ ਡ ਢ ਣ","color":"amber"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Before learning new letters, quickly remind yourself of the three sound groups you''ve already learned. Every new row follows exactly the same pattern.');

  -- Segment 4 — Dental consonants
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Dental consonants',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Circle","label":"ਤ — Tatta"},
        {"icon":"Circle","label":"ਥ — Thattha"},
        {"icon":"Circle","label":"ਦ — Dadda"},
        {"icon":"Circle","label":"ਧ — Dhadda"},
        {"icon":"Circle","label":"ਨ — Nanna"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Dental sounds are made by placing your tongue against your teeth. These are some of the most commonly used consonants in Punjabi.');

  -- Segment 5 — Practise: Dental row
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Practise: Dental row',
    'activity_scene', '{"icons":["BookOpen"],"caption":"Recognising dental consonants"}'::jsonb,
    'flashcard_set', v_dental_deck_id,
    'Practise the dental row in both directions: Gurmukhi → romanised name, and romanised name → Gurmukhi.'
  ) RETURNING id INTO v_seg;

  -- Segment 6 — Labial consonants
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Labial consonants',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Circle","label":"ਪ — Pappa"},
        {"icon":"Circle","label":"ਫ — Phappa"},
        {"icon":"Circle","label":"ਬ — Babba"},
        {"icon":"Circle","label":"ਭ — Bhabba"},
        {"icon":"Circle","label":"ਮ — Mamma"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Labial sounds are produced using your lips. Because these sounds exist in English too, most learners find this row easier to remember.');

  -- Segment 7 — Practise: Labial row
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 7, 7, 'Practise: Labial row',
    'activity_scene', '{"icons":["BookOpen"],"caption":"Recognising labial consonants"}'::jsonb,
    'flashcard_set', v_labial_deck_id,
    'Practise the labial row in both directions: Gurmukhi → romanised name, and romanised name → Gurmukhi.'
  ) RETURNING id INTO v_seg;

  -- Segment 8 — The remaining letters
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'The remaining letters',
    'icon_hero', '{"icons":["Sparkles"],"label":"Special consonants","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'These letters don''t fit neatly into the five consonant rows, but they''re still extremely common and appear in many everyday Punjabi words: ਯ Yayya, ਰ Rara, ਲ Lalla, ਵ Vava, and ੜ Rrarra — the rolled sound unique to Punjabi.');

  -- Segment 9 — Additional consonants
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 9, 9, 'Additional consonants',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Circle","label":"ਸ਼ — Shasha"},
        {"icon":"Circle","label":"ਖ਼ — Khha"},
        {"icon":"Circle","label":"ਗ਼ — Ghha"},
        {"icon":"Circle","label":"ਜ਼ — Zza"},
        {"icon":"Circle","label":"ਫ਼ — Fafa"},
        {"icon":"Circle","label":"ਲ਼ — Llla"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'These additional letters mainly appear in words borrowed from Persian, Arabic, Urdu and English. You''ll recognise them in many modern Punjabi words.');

  -- Segment 10 — Complete consonant chart
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Recognising the full alphabet',
    'conjugation_table',
    '{
      "title": "Complete consonant chart — recognise patterns, not every detail at once",
      "columns": ["Sound group", "Letters", "Mouth position"],
      "rows": [
        {"Sound group":"Velar","Letters":"ਕ ਖ ਗ ਘ ਙ","Mouth position":"Back of the mouth"},
        {"Sound group":"Palatal","Letters":"ਚ ਛ ਜ ਝ ਞ","Mouth position":"Middle of the tongue"},
        {"Sound group":"Retroflex","Letters":"ਟ ਠ ਡ ਢ ਣ","Mouth position":"Tongue curls back"},
        {"Sound group":"Dental","Letters":"ਤ ਥ ਦ ਧ ਨ","Mouth position":"Tongue touches teeth"},
        {"Sound group":"Labial","Letters":"ਪ ਫ ਬ ਭ ਮ","Mouth position":"Lips"},
        {"Sound group":"Semivowels","Letters":"ਯ ਰ ਲ ਵ ੜ","Mouth position":"Common everyday sounds"},
        {"Sound group":"Additional","Letters":"ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼","Mouth position":"Borrowed / rare sounds"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'For the first time, look at the complete consonant chart. Rather than trying to memorise everything, begin recognising patterns and familiar shapes.');

  -- Segment 11 — Alphabet recognition
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Alphabet recognition',
    'activity_scene', '{"icons":["Languages"],"caption":"Find the correct letter"}'::jsonb,
    'fill_blank', 'Type the Gurmukhi letter or its romanised name. Both are accepted.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, '___', '___', 'Which letter makes the "b" sound?', 'ਬ', 'Babba'),
    (v_seg, 2, '___', '___', 'Which letter is Nanna?', 'ਨ', 'Nanna'),
    (v_seg, 3, '___', '___', 'Which letter is Yayya?', 'ਯ', 'Yayya'),
    (v_seg, 4, '___', '___', 'Which letter is Rara?', 'ਰ', 'Rara'),
    (v_seg, 5, '___', '___', 'Which letter is Lalla?', 'ਲ', 'Lalla'),
    (v_seg, 6, '___', '___', 'Which letter is Vava?', 'ਵ', 'Vava'),
    (v_seg, 7, '___', '___', 'Which letter is Rrarra?', 'ੜ', 'Rrarra');

  -- Segment 12 — Reading challenge (flashcard recognition, no scoring)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Reading challenge',
    'activity_scene', '{"icons":["Eye"],"caption":"Recognise, don''t memorise"}'::jsonb,
    'flashcard_set', v_reading_deck_id,
    'Flip through the full consonant set. For each letter, say its name and sound aloud — recognition practice only, no grading.'
  ) RETURNING id INTO v_seg;

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Recognise every Punjabi consonant"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You''ve now learned every standard Punjabi consonant. Next lesson we''ll add vowel sounds, allowing these letters to combine into complete syllables and real words.');

  -- Segment 14 — Lesson 2 quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Lesson 2 quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Foundations Lesson 2 Quiz"}'::jsonb,
    'quiz', 'Take the Foundations Lesson 2 quiz — dental and labial rows, remaining and additional consonants, identify letters by sound and match romanised names.'
  );

  -- Segment 15 — Homework (text submission)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: master the consonants","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Write each consonant row, then answer the four questions below. Gurmukhi or romanised is fine — your tutor will review your written work.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'Write the dental row: ਤ ਥ ਦ ਧ ਨ', 'ਤ ਥ ਦ ਧ ਨ', 'Tatta Thattha Dadda Dhadda Nanna'),
    (v_seg, 2, 'Write the labial row: ਪ ਫ ਬ ਭ ਮ', 'ਪ ਫ ਬ ਭ ਮ', 'Pappa Phappa Babba Bhabba Mamma'),
    (v_seg, 3, 'Write the remaining consonants: ਯ ਰ ਲ ਵ ੜ', 'ਯ ਰ ਲ ਵ ੜ', 'Yayya Rara Lalla Vava Rrarra'),
    (v_seg, 4, 'Write the additional consonants: ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼', 'ਸ਼ ਖ਼ ਗ਼ ਜ਼ ਫ਼ ਲ਼', 'Shasha Khha Ghha Zza Fafa Llla'),
    (v_seg, 5, 'Which letters use the lips?', 'ਪ ਫ ਬ ਭ ਮ', 'Labial row — Pappa Phappa Babba Bhabba Mamma'),
    (v_seg, 6, 'Which letters use the teeth?', 'ਤ ਥ ਦ ਧ ਨ', 'Dental row — Tatta Thattha Dadda Dhadda Nanna'),
    (v_seg, 7, 'Which consonant is used for the English "v" sound?', 'ਵ', 'Vava'),
    (v_seg, 8, 'Which consonant represents the rolled Punjabi ੜ sound?', 'ੜ', 'Rrarra');

  RAISE NOTICE 'Foundational Lesson 2 catch-up seed complete for lesson %', v_lesson_id;
END $$;
