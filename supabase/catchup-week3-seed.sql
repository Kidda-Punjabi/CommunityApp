-- =============================================================================
-- Kidda — Week 3 (Verb Roots + Continuous Tense) catch-up seed
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
  v_week3_verb_deck_id UUID;
  v_week3_numbers_deck_id UUID;
  v_seg UUID;
BEGIN
  SELECT l.id INTO v_lesson_id
  FROM public.lessons l
  JOIN public.courses c ON c.id = l.course_id
  WHERE c.required_tier = 'beginners'
    AND l.lesson_number = 3
  LIMIT 1;

  IF v_lesson_id IS NULL THEN
    RAISE EXCEPTION 'Beginners lesson_number = 3 not found.';
  END IF;

  SELECT id INTO v_master_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Vocabulary - Master List'
  LIMIT 1;

  IF v_master_deck_id IS NULL THEN
    RAISE EXCEPTION 'Master vocabulary deck not found.';
  END IF;

  -- Dedicated Week 3 decks (idempotent)
  SELECT id INTO v_week3_verb_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 3 - Vowel-root verbs'
  LIMIT 1;

  IF v_week3_verb_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 3 - Vowel-root verbs',
      'Vowel-root and kanaa-root verbs for Week 3 catch-up (present tense patterns).'
    )
    RETURNING id INTO v_week3_verb_deck_id;
  END IF;

  SELECT id INTO v_week3_numbers_deck_id
  FROM public.flashcard_sets
  WHERE name = 'Week 3 - Numbers 21-50'
  LIMIT 1;

  IF v_week3_numbers_deck_id IS NULL THEN
    INSERT INTO public.flashcard_sets (name, description)
    VALUES (
      'Week 3 - Numbers 21-50',
      'Gurmukhi numerals and spoken forms for 21 through 50.'
    )
    RETURNING id INTO v_week3_numbers_deck_id;
  END IF;

  -- ---------------------------------------------------------------------------
  -- New verb flashcards on master deck (create only if missing by front_text)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_master_deck_id, v.front, v.back, v.roman, 'vocab', 'Vocabulary - Master List', ARRAY['week_3', 'verb']::text[]
  FROM (VALUES
    ('to make', 'ਬਣਾਉਣਾ', 'banauna'),
    ('to lose', 'ਹਾਰਨਾ', 'haarna'),
    ('to show', 'ਦਿਖਾਉਣਾ', 'dikhauna'),
    ('to teach', 'ਸਿਖਾਉਣਾ', 'sikhauna'),
    ('to rescue', 'ਬਚਾਉਣਾ', 'bachauna'),
    ('to scare', 'ਡਰਾਉਣਾ', 'darauna'),
    ('to sleep', 'ਸੌਣਾ', 'sauna'),
    ('to bring', 'ਲਿਆਉਣਾ', 'lyauna'),
    ('to tolerate', 'ਸਹਿਣਾ', 'sehna'),
    ('to rotate / turn', 'ਘੁਮਾਉਣਾ', 'ghumauna'),
    ('to say', 'ਕਹਿਣਾ', 'kehna'),
    ('to be', 'ਹੋਣਾ', 'hona'),
    ('to buy', 'ਖਰੀਦਣਾ', 'khareedna')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id = v_master_deck_id
      AND (
        f.front_text = v.front
        OR (v.front = 'to buy' AND (
          f.front_text ILIKE 'to buy%'
          OR f.romanised IN ('khareedna', 'kharidna')
        ))
      )
  );

  -- ---------------------------------------------------------------------------
  -- Populate Week 3 verb deck from master (link existing + newly created)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT DISTINCT ON (f.front_text)
    v_week3_verb_deck_id,
    f.front_text,
    f.back_text,
    f.romanised,
    COALESCE(f.category, 'vocab'),
    'Week 3 - Vowel-root verbs',
    ARRAY['week_3', 'verb']::text[]
  FROM public.flashcards f
  WHERE f.deck_id = v_master_deck_id
    AND (
      f.front_text IN (
        'to make', 'to lose', 'to show', 'to teach', 'to rescue', 'to scare',
        'to sleep', 'to bring', 'to tolerate', 'to rotate / turn',
        'to sing', 'to come', 'to eat', 'to live', 'to give', 'to drink', 'to go'
      )
      OR f.front_text ILIKE 'to take%'
      OR f.front_text ILIKE 'to receive%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.flashcards w
      WHERE w.deck_id = v_week3_verb_deck_id AND w.front_text = f.front_text
    )
  ORDER BY f.front_text, f.created_at NULLS LAST, f.id;

  -- ---------------------------------------------------------------------------
  -- Numbers 21-50 (dup-check 30, 40, 50 against any existing card)
  -- ---------------------------------------------------------------------------

  INSERT INTO public.flashcards (deck_id, front_text, back_text, romanised, category, deck_name, topic_tags)
  SELECT v_week3_numbers_deck_id, v.front, v.back, v.roman, 'vocab', 'Week 3 - Numbers 21-50', ARRAY['week_3', 'number']::text[]
  FROM (VALUES
    ('21', '੨੧ — ਇੱਕੀ', 'ikki'),
    ('22', '੨੨ — ਬਾਈ', 'baee'),
    ('23', '੨੩ — ਤੇਈ', 'teyee'),
    ('24', '੨੪ — ਚੌਵੀ', 'chauvee'),
    ('25', '੨੫ — ਪੱਚੀ', 'pachi'),
    ('26', '੨੬ — ਛੱਬੀ', 'chhabbi'),
    ('27', '੨੭ — ਸਤਾਈ', 'sataai'),
    ('28', '੨੮ — ਅਠਾਈ', 'athaai'),
    ('29', '੨੯ — ਉਨੱਤੀ', 'unatti'),
    ('30', '੩੦ — ਤੀਹ', 'teeh'),
    ('31', '੩੧ — ਇਕੱਤੀ', 'ikkatti'),
    ('32', '੩੨ — ਬੱਤੀ', 'batti'),
    ('33', '੩੩ — ਤੈਂਤੀ', 'taiti'),
    ('34', '੩੪ — ਚੌਂਤੀ', 'chaunti'),
    ('35', '੩੫ — ਪੈਂਤੀ', 'painti'),
    ('36', '੩੬ — ਛੱਤੀ', 'chhatti'),
    ('37', '੩੭ — ਸੈਂਤੀ', 'sainti'),
    ('38', '੩੮ — ਅਠੱਤੀ', 'athatti'),
    ('39', '੩੯ — ਉਨਤਾਲੀ', 'untaali'),
    ('40', '੪੦ — ਚਾਲੀ', 'chaali'),
    ('41', '੪੧ — ਇਕਤਾਲੀ', 'iktaali'),
    ('42', '੪੨ — ਬਿਆਲੀ', 'byaali'),
    ('43', '੪੩ — ਤੇਤਾਲੀ', 'tetaali'),
    ('44', '੪੪ — ਚੁਤਾਲੀ', 'chutaali'),
    ('45', '੪੫ — ਪੰਤਾਲੀ', 'pantaali'),
    ('46', '੪੬ — ਛਿਆਲੀ', 'chiaali'),
    ('47', '੪੭ — ਸੰਤਾਲੀ', 'santaali'),
    ('48', '੪੮ — ਅਠਤਾਲੀ', 'athtaali'),
    ('49', '੪੯ — ਉਨੰਜਾ', 'unanja'),
    ('50', '੫੦ — ਪੰਜਾਹ', 'panjaah')
  ) AS v(front, back, roman)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.flashcards f
    WHERE f.deck_id IN (v_week3_numbers_deck_id, v_master_deck_id)
      AND (
        f.front_text = v.front
        OR f.romanised = v.roman
        OR (v.front IN ('30', '40', '50') AND f.front_text IN ('30', '40', '50'))
      )
  );

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1 — Week 2 recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 1, 1, 'Week 2 recap',
    'recap_banner', '{"icon":"RotateCcw","heading":"Last week","subheading":"Subject + Object + Verb + Aux"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Last week you learned the Punjabi sentence formula and how verb endings change for gender. This week we go one level deeper — into why verbs conjugate the way they do.');

  -- Segment 2 — Consonants and vowels recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 2, 2, 'Consonants and vowels recap',
    'icon_hero', '{"icons":["Type"],"label":"The Gurmukhi alphabet","accentColor":"purple"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Quick refresher: Gurmukhi has consonants and vowels, and which one a verb root ends in changes how it conjugates. That''s what today is really about.');

  -- Segment 3 — Understanding verb roots
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 3, 3, 'Understanding verb roots',
    'icon_hero', '{"icons":["Scissors"],"label":"Verb = root + ending","accentColor":"teal"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Every Punjabi verb has two parts: the root and the infinitive ending -ਣਾ (na). Khedna (to play) splits into khed (play) + na (the ''to'' marker). The na disappears once you conjugate — it''s just there to mark the dictionary form.');

  -- Segment 4 — Three types of verb roots
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 4, 4, 'Three types of verb roots',
    'zone_diagram',
    '{
      "zones": [
        {"icon":"Type","label":"Consonant ending","sublabel":"khedna → khedda haa (I play)","color":"purple"},
        {"icon":"CircleDot","label":"Kanaa (ਾ) ending","sublabel":"gauna → gaunda haa (I sing)","color":"amber"},
        {"icon":"Circle","label":"Other endings","sublabel":"peena → peenda haa (I drink)","color":"teal"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'The verb root''s last sound decides which ending pattern it follows. Khed ends in a consonant, so it takes -da/-di/-de directly. Gaa (from gauna) ends in the kanaa vowel sound, so it takes -unda/-undi/-unde. Pee (from peena) ends in another vowel, so it also takes a linking -nda/-ndi/-nde. Same idea, three small variations.');

  -- Segment 5 — Reference conjugation tables (1b + 1c grids)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 5, 5, 'Reference: the three conjugation tables',
    'conjugation_table',
    '{
      "title": "Tables 1b & 1c — vowel-root endings (+ same aux: haa/hai/han/ho)",
      "columns": ["Pattern", "Example verb", "Masculine", "Feminine", "Plural"],
      "rows": [
        {"Pattern":"1a Consonant","Example verb":"khedna (play)","Masculine":"-da","Feminine":"-di","Plural":"-de"},
        {"Pattern":"1b Kanaa (ਾ)","Example verb":"gauna (sing)","Masculine":"-unda","Feminine":"-undi","Plural":"-unde"},
        {"Pattern":"1c Other vowel","Example verb":"peena (drink)","Masculine":"-nda","Feminine":"-ndi","Plural":"-nde"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Table 1a (consonant roots, e.g. khedna): khedda/kheddi/khedde + haa/hai/han/ho. Table 1b (kanaa roots, e.g. gauna): gaunda/gaundi/gaunde + same aux verbs. Table 1c (other roots, e.g. peena): peenda/peendi/peende + same aux verbs. The aux verb pattern never changes — only the verb ending does.');

  -- Segment 6 — Vocab: vowel-root verbs
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 6, 6, 'Vocab: vowel-root verbs',
    'icon_hero', '{"icons":["BookOpen"],"label":"Vowel-root verbs","accentColor":"teal"}'::jsonb,
    'flashcard_set', v_week3_verb_deck_id,
    'Review these vowel-root and kanaa-root verbs. Notice how the root ending predicts the -unda/-nda pattern.'
  ) RETURNING id INTO v_seg;

  -- Segment 7 — Irregular verbs
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 7, 7, 'Irregular verbs',
    'activity_scene', '{"icons":["AlertTriangle"],"caption":"The exceptions"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'A few verbs bend the rules. Rehna (to live), kehna (to say), and hona (to be) all end in ਹ — insert a nasal tippi before the ending: rehnda, kehnda, hunda. Jaana (to go) and khaana (to eat) are kanaa-root exceptions that only take a light nasal bindi: jaanda, khaanda. Dena (to give) is fully irregular: dinda, not deenda.');

  -- Segment 8 — Translate: present tense verbs
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 8, 8, 'Translate: present tense verbs',
    'activity_scene', '{"icons":["Languages"],"caption":"Using the verb charts"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'He makes', 'ਉਹ ਬਣਾਉਂਦਾ ਹੈ', 'Oh banaunda hai'),
    (v_seg, 2, 'I go', 'ਮੈਂ ਜਾਂਦਾ ਹਾਂ', 'Mai jaanda haa'),
    (v_seg, 3, 'She sings', 'ਉਹ ਗਾਉਂਦੀ ਹੈ', 'Oh gaundi hai'),
    (v_seg, 4, 'We come', 'ਅਸੀਂ ਆਉਂਦੇ ਹਾਂ', 'Asi aunde haa'),
    (v_seg, 5, 'You eat', 'ਤੁਸੀਂ ਖਾਂਦੇ ਹੋ', 'Tusi khaande ho'),
    (v_seg, 6, 'They live', 'ਉਹ ਰਹਿੰਦੇ ਹਨ', 'Oh rehnde han'),
    (v_seg, 7, 'Raj loses', 'ਰਾਜ ਹਾਰਦਾ ਹੈ', 'Raj haarda hai'),
    (v_seg, 8, 'I make', 'ਮੈਂ ਬਣਾਉਂਦਾ ਹਾਂ', 'Mai banaunda haa'),
    (v_seg, 9, 'They show', 'ਉਹ ਦਿਖਾਉਂਦੇ ਹਨ', 'Oh dikhaunde han'),
    (v_seg, 10, 'We come back', 'ਅਸੀਂ ਵਾਪਸ ਆਉਂਦੇ ਹਾਂ', 'Asi vapas aunde haa'),
    (v_seg, 11, 'She brings', 'ਉਹ ਲਿਆਉਂਦੀ ਹੈ', 'Oh lyaundi hai'),
    (v_seg, 12, 'You teach', 'ਤੁਸੀਂ ਸਿਖਾਉਂਦੇ ਹੋ', 'Tusi sikhaunde ho'),
    (v_seg, 13, 'He rescues', 'ਉਹ ਬਚਾਉਂਦਾ ਹੈ', 'Oh bachaunda hai'),
    (v_seg, 14, 'I give', 'ਮੈਂ ਦਿੰਦਾ ਹਾਂ', 'Mai dinda haa'),
    (v_seg, 15, 'She scares', 'ਉਹ ਡਰਾਉਂਦੀ ਹੈ', 'Oh daraundi hai'),
    (v_seg, 16, 'We sleep', 'ਅਸੀਂ ਸੌਂਦੇ ਹਾਂ', 'Asi saunde haa'),
    (v_seg, 17, 'I drink', 'ਮੈਂ ਪੀਂਦਾ ਹਾਂ', 'Mai peenda haa'),
    (v_seg, 18, 'You take', 'ਤੁਸੀਂ ਲੈਂਦੇ ਹੋ', 'Tusi lainde ho');

  -- Segment 9 — Numbers 1-50
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_ref_id, activity_instructions
  ) VALUES (
    v_lesson_id, 9, 9, 'Numbers 1-50',
    'icon_hero', '{"icons":["Hash"],"label":"Counting to 50","accentColor":"amber"}'::jsonb,
    'flashcard_set', v_week3_numbers_deck_id,
    'These are shown with Gurmukhi numerals (੧੨੩) alongside the words — practise recognising both.'
  ) RETURNING id INTO v_seg;

  -- Segment 10 — The continuous tense (-ing)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 10, 10, 'The continuous tense (-ing)',
    'icon_hero', '{"icons":["Infinity"],"label":"Rehna → -ing","accentColor":"coral"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Rehna means ''to stay/remain''. Punjabi uses a shortened form of it to build the ''-ing'' continuous tense: reha for a male speaker, rahi for a female speaker, rahe for plural, rahiaan for feminine plural.');

  -- Segment 11 — Continuous tense forms
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 11, 11, 'Continuous tense forms',
    'phrase_showcase',
    '{
      "items": [
        {"icon":"User","label":"reha — male singular"},
        {"icon":"User","label":"rahi — female singular"},
        {"icon":"Users","label":"rahe — plural"},
        {"icon":"Users","label":"rahiaan — feminine plural"}
      ]
    }'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'To build it: verb root + reha/rahi/rahe/rahiaan + the same aux verb (haa/hai/han/ho) as always. Mai parh reha haa — I am reading.');

  -- Segment 12 — Translate: continuous tense
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 12, 12, 'Translate: continuous tense',
    'activity_scene', '{"icons":["Languages"],"caption":"Using the continuous tense"}'::jsonb,
    'translate', 'Translate each English sentence into Punjabi using the continuous tense. Romanised input is fine.'
  ) RETURNING id INTO v_seg;

  INSERT INTO public.translate_questions (segment_id, question_number, prompt_english, answer_gurmukhi, answer_romanised) VALUES
    (v_seg, 1, 'I am eating', 'ਮੈਂ ਖਾ ਰਿਹਾ ਹਾਂ', 'Mai kha reha haa'),
    (v_seg, 2, 'She is drinking', 'ਉਹ ਪੀ ਰਹੀ ਹੈ', 'Oh pee rahi hai'),
    (v_seg, 3, 'He is reading', 'ਉਹ ਪੜ੍ਹ ਰਿਹਾ ਹੈ', 'Oh parh reha hai'),
    (v_seg, 4, 'They are walking', 'ਉਹ ਤੁਰ ਰਹੇ ਹਨ', 'Oh tur rahe han'),
    (v_seg, 5, 'We are watching', 'ਅਸੀਂ ਵੇਖ ਰਹੇ ਹਾਂ', 'Asi vekh rahe haa'),
    (v_seg, 6, 'You are learning', 'ਤੁਸੀਂ ਸਿੱਖ ਰਹੇ ਹੋ', 'Tusi sikh rahe ho'),
    (v_seg, 7, 'I am writing', 'ਮੈਂ ਲਿਖ ਰਿਹਾ ਹਾਂ', 'Mai likh reha haa'),
    (v_seg, 8, 'She is cooking', 'ਉਹ ਪਕਾ ਰਹੀ ਹੈ', 'Oh paka rahi hai'),
    (v_seg, 9, 'They are sitting', 'ਉਹ ਬੈਠ ਰਹੇ ਹਨ', 'Oh baith rahe han'),
    (v_seg, 10, 'He is speaking', 'ਉਹ ਬੋਲ ਰਿਹਾ ਹੈ', 'Oh bol reha hai'),
    (v_seg, 11, 'We are playing', 'ਅਸੀਂ ਖੇਡ ਰਹੇ ਹਾਂ', 'Asi khed rahe haa'),
    (v_seg, 12, 'You are listening', 'ਤੁਸੀਂ ਸੁਣ ਰਹੇ ਹੋ', 'Tusi sun rahe ho'),
    (v_seg, 13, 'I am cleaning', 'ਮੈਂ ਸਾਫ਼ ਕਰ ਰਿਹਾ ਹਾਂ', 'Mai saaf kar reha haa'),
    (v_seg, 14, 'She is opening', 'ਉਹ ਖੋਲ ਰਹੀ ਹੈ', 'Oh khol rahi hai'),
    (v_seg, 15, 'They are buying', 'ਉਹ ਖਰੀਦ ਰਹੇ ਹਨ', 'Oh khareed rahe han');

  -- Segment 13 — Recap
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config, activity_type
  ) VALUES (
    v_lesson_id, 13, 13, 'Recap',
    'recap_banner', '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Conjugate any verb, present or continuous"}'::jsonb,
    'none'
  ) RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You now know the three verb-root patterns, the key irregular verbs, and how to build the continuous ''-ing'' tense using reha/rahi/rahe/rahiaan.');

  -- Segment 14 — Recap quiz (link quiz in admin)
  INSERT INTO public.lesson_segments (
    lesson_id, segment_number, sort_order, title,
    teaching_visual_type, teaching_visual_config,
    activity_type, activity_instructions
  ) VALUES (
    v_lesson_id, 14, 14, 'Recap quiz',
    'quiz_banner', '{"icon":"ClipboardCheck","heading":"Week 3 recap quiz"}'::jsonb,
    'quiz', 'Take the Week 3 recap quiz to lock in verb roots and the continuous tense.'
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
    (v_seg, 1, 'I drink', 'ਮੈਂ ਪੀਂਦਾ ਹਾਂ', 'Mai peenda haa'),
    (v_seg, 2, 'He takes', 'ਉਹ ਲੈਂਦਾ ਹੈ', 'Oh lainda hai'),
    (v_seg, 3, 'They sleep', 'ਉਹ ਸੌਂਦੇ ਹਨ', 'Oh saunde han'),
    (v_seg, 4, 'We drink', 'ਅਸੀਂ ਪੀਂਦੇ ਹਾਂ', 'Asi peende haa'),
    (v_seg, 5, 'Simran takes', 'ਸਿਮਰਨ ਲੈਂਦੀ ਹੈ', 'Simran laindi hai'),
    (v_seg, 6, 'Aman drinks', 'ਅਮਨ ਪੀਂਦਾ ਹੈ', 'Aman peenda hai'),
    (v_seg, 7, 'I sleep', 'ਮੈਂ ਸੌਂਦਾ ਹਾਂ', 'Mai saunda haa'),
    (v_seg, 8, 'They receive', 'ਉਹ ਲੈਂਦੇ ਹਨ', 'Oh lainde han'),
    (v_seg, 9, 'You sleep', 'ਤੁਸੀਂ ਸੌਂਦੇ ਹੋ', 'Tusi saunde ho'),
    (v_seg, 10, 'We receive', 'ਅਸੀਂ ਲੈਂਦੇ ਹਾਂ', 'Asi lainde haa'),
    (v_seg, 11, 'Karan is taking', 'ਕਰਨ ਲੈ ਰਿਹਾ ਹੈ', 'Karan lai reha hai'),
    (v_seg, 12, 'He is drinking', 'ਉਹ ਪੀ ਰਿਹਾ ਹੈ', 'Oh pee reha hai'),
    (v_seg, 13, 'Jaspreet is speaking', 'ਜਸਪ੍ਰੀਤ ਬੋਲ ਰਹੀ ਹੈ', 'Jaspreet bol rahi hai'),
    (v_seg, 14, 'They are drinking', 'ਉਹ ਪੀ ਰਹੇ ਹਨ', 'Oh pee rahe han'),
    (v_seg, 15, 'I am watching', 'ਮੈਂ ਵੇਖ ਰਿਹਾ ਹਾਂ', 'Mai vekh reha haa');

  RAISE NOTICE 'Week 3 catch-up seed complete for lesson %', v_lesson_id;
  RAISE NOTICE 'Week 3 verb deck: %', v_week3_verb_deck_id;
  RAISE NOTICE 'Week 3 numbers deck: %', v_week3_numbers_deck_id;
END $$;
