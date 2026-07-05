-- =============================================================================
-- Kidda — Foundational Course Lesson 3 (Independent Vowels + Matras) catch-up seed
-- Run after:
--   supabase/catchup-lesson-segments.sql
--   supabase/catchup-teaching-visuals.sql
--   supabase/catchup-week2-activities.sql
--   supabase/homework-submissions-text.sql
--   supabase/catchup-foundational-lesson1-seed.sql
--   supabase/catchup-foundational-lesson2-seed.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID;
  v_alphabet_deck_id UUID;
  v_vowels_deck_id UUID;
  v_matras_deck_id UUID;
  v_words_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'foundational'
    AND l.lesson_number = 3
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Foundational lesson_number = 3 not found.';
  END IF;

  SELECT id INTO v_alphabet_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations - Gurmukhi Alphabet'
  LIMIT 1;

  IF v_alphabet_deck_id IS NULL THEN
    RAISE EXCEPTION 'Foundations - Gurmukhi Alphabet deck not found — run catchup-foundational-lesson1-seed.sql first.';
  END IF;

  SELECT id INTO v_vowels_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L3 - Independent vowels'
  LIMIT 1;

  IF v_vowels_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L3 - Independent vowels',
      'Independent Gurmukhi vowels: ਅ through ਔ.'
    )
    RETURNING id INTO v_vowels_deck_id;
  END IF;

  SELECT id INTO v_matras_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L3 - Matras'
  LIMIT 1;

  IF v_matras_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L3 - Matras',
      'Gurmukhi vowel markers (matras) with example syllables.'
    )
    RETURNING id INTO v_matras_deck_id;
  END IF;

  SELECT id INTO v_words_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Foundations L3 - Beginner words'
  LIMIT 1;

  IF v_words_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Foundations L3 - Beginner words',
      'Simple Punjabi words for first reading practice.'
    )
    RETURNING id INTO v_words_deck_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- Independent vowels on master deck (create only if missing; ਅ may exist)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (
    deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty
  )
  SELECT v_alphabet_deck_id, v.gurmukhi, v.back, v.roman, 'alphabet', 'Foundations - Gurmukhi Alphabet', v.tags, v.diff
  FROM (VALUES
    ('ਅ', 'Airaa — a (as in apple)', 'Airaa', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਆ', 'Aaraa — aa (long a)', 'Aaraa', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਇ', 'Iri — i (short i)', 'Iri', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਈ', 'Iiri — ee (long i)', 'Iiri', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਉ', 'Ura — u (short u)', 'Ura', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਊ', 'Uura — oo (long u)', 'Uura', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਏ', 'Ee — e', 'Ee', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਐ', 'Ai — ai', 'Ai', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਓ', 'Oanka — o', 'Oanka', ARRAY['foundational', 'independent_vowel']::text[], 2),
    ('ਔ', 'Aunkar — au', 'Aunkar', ARRAY['foundational', 'independent_vowel']::text[], 2)
  ) AS v(gurmukhi, back, roman, tags, diff)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_alphabet_deck_id
      AND (
        f.front_text = v.gurmukhi
        OR f.romanised = v.roman
        OR (v.gurmukhi = 'ਅ' AND f.front_text = 'ਅ')
      )
  );

  -- Matras on master deck (create only if missing)
  INSERT INTO public.flashcards (
    deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty
  )
  SELECT v_alphabet_deck_id, v.gurmukhi, v.back, v.roman, 'alphabet', 'Foundations - Gurmukhi Alphabet', v.tags, v.diff
  FROM (VALUES
    ('ਾ', 'Kangaa — aa matra (ਕਾ = kaa)', 'Kangaa', ARRAY['foundational', 'matra']::text[], 2),
    ('ਿ', 'Sihari — i matra (ਕਿ = ki)', 'Sihari', ARRAY['foundational', 'matra']::text[], 2),
    ('ੀ', 'Bihari — ee matra (ਕੀ = kee)', 'Bihari', ARRAY['foundational', 'matra']::text[], 2),
    ('ੁ', 'Aunkar — u matra (ਕੁ = ku)', 'Aunkar matra', ARRAY['foundational', 'matra']::text[], 2),
    ('ੂ', 'Dulankar — oo matra (ਕੂ = koo)', 'Dulankar', ARRAY['foundational', 'matra']::text[], 2),
    ('ੇ', 'Lanvan — e matra (ਕੇ = ke)', 'Lanvan', ARRAY['foundational', 'matra']::text[], 2),
    ('ੈ', 'Dulavan — ai matra (ਕੈ = kai)', 'Dulavan', ARRAY['foundational', 'matra']::text[], 2),
    ('ੋ', 'Horha — o matra (ਕੋ = ko)', 'Horha', ARRAY['foundational', 'matra']::text[], 2),
    ('ੌ', 'Kanaura — au matra (ਕੌ = kau)', 'Kanaura', ARRAY['foundational', 'matra']::text[], 2)
  ) AS v(gurmukhi, back, roman, tags, diff)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_alphabet_deck_id
      AND (
        f.front_text = v.gurmukhi
        OR f.romanised = v.roman
        OR (v.roman = 'Aunkar matra' AND f.romanised IN ('Aunkar matra', 'Aunkar'))
      )
  );

  -- Populate independent vowels deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (f.front_text)
    v_vowels_deck_id, f.front_text, f.back_text, f.romanised,
    COALESCE(f.category, 'alphabet'), 'Foundations L3 - Independent vowels', f.topic_tags, f.difficulty
  FROM public.flashcards f
  WHERE f.deck_id = v_alphabet_deck_id
    AND f.front_text IN ('ਅ', 'ਆ', 'ਇ', 'ਈ', 'ਉ', 'ਊ', 'ਏ', 'ਐ', 'ਓ', 'ਔ')
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_vowels_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  -- Populate matras deck from master
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT DISTINCT ON (f.front_text)
    v_matras_deck_id, f.front_text, f.back_text, f.romanised,
    COALESCE(f.category, 'alphabet'), 'Foundations L3 - Matras', f.topic_tags, f.difficulty
  FROM public.flashcards f
  WHERE f.deck_id = v_alphabet_deck_id
    AND f.front_text IN ('ਾ', 'ਿ', 'ੀ', 'ੁ', 'ੂ', 'ੇ', 'ੈ', 'ੋ', 'ੌ')
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_matras_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  -- Beginner reading words (practice deck only)
  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags, difficulty)
  SELECT v_words_deck_id, v.gurmukhi, v.back, v.roman, 'alphabet', 'Foundations L3 - Beginner words', ARRAY['foundational', 'reading_word']::text[], 2
  FROM (VALUES
    ('ਘਰ', 'ghar — home', 'ghar'),
    ('ਨਾਮ', 'naam — name', 'naam'),
    ('ਕਮ', 'kam — work', 'kam'),
    ('ਆਮ', 'aam — mango', 'aam'),
    ('ਪਾਣੀ', 'paani — water', 'paani'),
    ('ਕਿਤਾਬ', 'kitaab — book', 'kitaab')
  ) AS v(gurmukhi, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_words_deck_id
      AND (f.front_text = v.gurmukhi OR f.romanised = v.roman)
  );

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Lesson 2 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Lesson 2 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last lesson","subheading":"Every Punjabi consonant"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last lesson you completed the Punjabi consonant chart. You now recognise every consonant used in everyday Punjabi. Today we''ll learn the final piece of the puzzle: vowels.');

  -- Segment 2 — Why vowels matter
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Why vowels matter',
    'icon_hero', '{"icons":["Type"],"label":"Consonants need vowels","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Consonants on their own can only represent part of a sound. Vowels complete the sound and allow us to pronounce full syllables. Once you understand vowels, you''ll begin reading actual Punjabi words.');

  -- Segment 3 — Two types of vowels
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Two types of vowels',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Circle","label":"Independent vowels","sublabel":"ਅ ਆ ਇ ਈ…","color":"purple"},
        {"icon":"PenTool","label":"Matras (vowel markers)","sublabel":"ਾ ਿ ੀ ੁ ੂ…","color":"teal"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Punjabi has two ways of writing vowels. Independent vowels are used when a word begins with a vowel sound. Matras are small symbols attached to consonants that change their pronunciation.');

  -- Segment 4 — Independent vowels
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Independent vowels',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Circle","label":"ਅ — Airaa"},
        {"icon":"Circle","label":"ਆ — Aaraa"},
        {"icon":"Circle","label":"ਇ — Iri"},
        {"icon":"Circle","label":"ਈ — Iiri"},
        {"icon":"Circle","label":"ਉ — Ura"},
        {"icon":"Circle","label":"ਊ — Uura"},
        {"icon":"Circle","label":"ਏ — Ee"},
        {"icon":"Circle","label":"ਐ — Ai"},
        {"icon":"Circle","label":"ਓ — Oanka"},
        {"icon":"Circle","label":"ਔ — Aunkar"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Independent vowels are complete letters. They''re mainly used whenever a word starts with a vowel sound.');

  -- Segment 5 — Practise: Independent vowels
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 5, 5, 'Practise: Independent vowels',
    'activity_scene', '{"icons":["BookOpen"],"caption":"Recognising vowel letters"}'::jsonb,
    'flashcard_set', v_vowels_deck_id,
    'Practise independent vowels in both directions: Gurmukhi → romanised name/sound, and romanised → Gurmukhi.'
  ) RETURNING id INTO v_seg;

  -- Segment 6 — Introducing matras
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 6, 6, 'Introducing matras',
    'icon_hero', '{"icons":["PenTool"],"label":"Changing consonant sounds","accentColor":"green"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Matras aren''t separate letters. Instead, they''re attached to consonants to change the vowel sound. Think of them as pronunciation modifiers.');

  -- Segment 7 — The matra chart
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 7, 7, 'The matra chart',
    'conjugation_table',
    '{
      "title": "Punjabi vowel markers (matras) — example with ਕ (Kakka)",
      "columns": ["Matra", "Name", "Sound", "Example"],
      "rows": [
        {"Matra":"ਾ","Name":"Kangaa","Sound":"aa","Example":"ਕਾ (kaa)"},
        {"Matra":"ਿ","Name":"Sihari","Sound":"i","Example":"ਕਿ (ki)"},
        {"Matra":"ੀ","Name":"Bihari","Sound":"ee","Example":"ਕੀ (kee)"},
        {"Matra":"ੁ","Name":"Aunkar","Sound":"u","Example":"ਕੁ (ku)"},
        {"Matra":"ੂ","Name":"Dulankar","Sound":"oo","Example":"ਕੂ (koo)"},
        {"Matra":"ੇ","Name":"Lanvan","Sound":"e","Example":"ਕੇ (ke)"},
        {"Matra":"ੈ","Name":"Dulavan","Sound":"ai","Example":"ਕੈ (kai)"},
        {"Matra":"ੋ","Name":"Horha","Sound":"o","Example":"ਕੋ (ko)"},
        {"Matra":"ੌ","Name":"Kanaura","Sound":"au","Example":"ਕੌ (kau)"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Every matra changes the sound of a consonant. You''ll notice that the consonant itself stays the same while the attached vowel changes.');

  -- Segment 8 — Reading simple syllables
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 8, 8, 'Reading simple syllables',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"Type","label":"ਕ (ka)"},
        {"icon":"Type","label":"ਕਾ (kaa)"},
        {"icon":"Type","label":"ਕਿ (ki)"},
        {"icon":"Type","label":"ਕੀ (kee)"},
        {"icon":"Type","label":"ਕੁ (ku)"},
        {"icon":"Type","label":"ਕੂ (koo)"},
        {"icon":"Type","label":"ਕੇ (ke)"},
        {"icon":"Type","label":"ਕੈ (kai)"},
        {"icon":"Type","label":"ਕੋ (ko)"},
        {"icon":"Type","label":"ਕੌ (kau)"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Notice how the consonant never changes. Only the matra changes, giving the consonant a completely different vowel sound.');

  -- Segment 9 — Match the sound
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 9, 9, 'Activity: Match the sound',
    'activity_scene', '{"icons":["Languages"],"caption":"Recognising matras"}'::jsonb,
    'fill_blank', 'Type the Gurmukhi symbol, syllable or romanised matra name. Both are accepted.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.fill_blank_questions (segment_id, question_number, prompt_gurmukhi, prompt_romanised, prompt_english, blank_answer_gurmukhi, blank_answer_romanised) VALUES
    (v_seg, 1, '___', '___', 'Which matra makes kaa?', 'ਾ', 'Kangaa'),
    (v_seg, 2, '___', '___', 'Which word is pronounced kee?', 'ਕੀ', 'kee'),
    (v_seg, 3, '___', '___', 'Which symbol creates the oo sound?', 'ੂ', 'Dulankar'),
    (v_seg, 4, '___', '___', 'Which symbol creates the ai sound?', 'ੈ', 'Dulavan'),
    (v_seg, 5, '___', '___', 'Which matra makes ki?', 'ਿ', 'Sihari');

  -- Segment 10 — Building your first words
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'Building your first words',
    'icon_hero', '{"icons":["BookOpenCheck"],"label":"Putting sounds together","accentColor":"amber"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Now we''ll combine consonants and vowels to build complete Punjabi words. This is the first time you''ll begin reading rather than simply recognising letters. Try reading: ਘਰ (ghar — home), ਨਾਮ (naam — name), ਕਮ (kam — work), ਆਮ (aam — mango), ਪਾਣੀ (paani — water).');

  -- Segment 11 — Reading practice
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 11, 11, 'Reading practice',
    'activity_scene', '{"icons":["Eye"],"caption":"Read the word aloud"}'::jsonb,
    'flashcard_set', v_words_deck_id,
    'Read each word aloud, then flip the card to check the pronunciation and romanised spelling.'
  ) RETURNING id INTO v_seg;

  -- Segment 12 — Recognising patterns
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 12, 12, 'Recognising patterns',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Type","label":"Same consonant","sublabel":"ਕ ਕਾ ਕਿ ਕੀ","color":"purple"},
        {"icon":"PenTool","label":"Different vowel","sublabel":"Matra changes the sound","color":"teal"},
        {"icon":"Repeat","label":"Same vowel","sublabel":"ਾ in ਕਾ and ਗਾ","color":"amber"},
        {"icon":"Shuffle","label":"Different consonant","sublabel":"ਕਾ vs ਪਾ","color":"coral"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Reading becomes much easier when you recognise patterns rather than individual letters. Focus on noticing how the same matra appears across many different words.');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Read syllables using vowels and matras"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You''ve now learned the Punjabi vowel system. You understand the difference between independent vowels and matras, and you''re beginning to read complete Punjabi syllables.');

  -- Segment 14 — Lesson 3 quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Lesson 3 quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Foundations Lesson 3 Quiz"}'::jsonb,
    'quiz', 'Take the Foundations Lesson 3 quiz — independent vowels, matras, matching sounds and reading simple syllables.'
  );

  -- Segment 15 — Homework (text submission)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions, homework_submission_type
  ) VALUES (
    v_lesson_id, 15, 15, 'Homework',
    'icon_hero', '{"icons":["PencilLine","Home"],"label":"Homework: practise reading syllables","accentColor":"coral"}'::jsonb,
    'homework', v_lesson_id,
    'Write the romanised pronunciation for each syllable row, then answer the four questions. Gurmukhi or romanised is fine — your tutor will review your written work.',
    'text'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.homework_text_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'ਕ syllables — write romanised: ਕ ਕਾ ਕਿ ਕੀ ਕੁ ਕੂ ਕੇ ਕੈ ਕੋ ਕੌ', 'ਕ ਕਾ ਕਿ ਕੀ ਕੁ ਕੂ ਕੇ ਕੈ ਕੋ ਕੌ', 'ka, kaa, ki, kee, ku, koo, ke, kai, ko, kau'),
    (v_seg, 2, 'ਗ syllables — write romanised forms (ga, gaa, gi, gee, gu, goo, ge, gai, go, gau)', NULL, 'ga, gaa, gi, gee, gu, goo, ge, gai, go, gau'),
    (v_seg, 3, 'ਪ syllables — write romanised forms', NULL, 'pa, paa, pi, pee, pu, poo, pe, pai, po, pau'),
    (v_seg, 4, 'ਬ syllables — write romanised forms', NULL, 'ba, baa, bi, bee, bu, boo, be, bai, bo, bau'),
    (v_seg, 5, 'ਮ syllables — write romanised forms', NULL, 'ma, maa, mi, mee, mu, moo, me, mai, mo, mau'),
    (v_seg, 6, 'ਤ syllables — write romanised forms', NULL, 'ta, taa, ti, tee, tu, too, te, tai, to, tau'),
    (v_seg, 7, 'What is the difference between an independent vowel and a matra?', NULL, 'Independent vowels are full letters used at the start of words; matras are vowel markers attached to consonants.'),
    (v_seg, 8, 'Which matra makes the ee sound?', 'ੀ', 'Bihari (ੀ)'),
    (v_seg, 9, 'Which matra makes the ai sound?', 'ੈ', 'Dulavan (ੈ)'),
    (v_seg, 10, 'Read five syllables aloud and write their romanised forms.', NULL, '(Open response — e.g. kaa, kee, ghar, naam, paani)');

  RAISE NOTICE 'Foundational Lesson 3 catch-up seed complete for lesson %', v_lesson_id;
END $$;
