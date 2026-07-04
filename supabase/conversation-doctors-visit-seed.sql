-- =============================================================================
-- Kidda — Conversation Practice seed: Going to the Doctor's (scenario 2 of 4)
-- Run in Supabase SQL Editor AFTER:
--   conversation-practice.sql
--   conversation-practice-turns.sql
--
-- Idempotent: deletes scenario by title (cascades exchanges, cast, turns),
-- then re-inserts. Global character "Doctor" is upserted by name.
--
-- Status: DRAFT — pending native-speaker review before production use.
-- =============================================================================

DELETE FROM public.conversation_scenarios
WHERE title = 'Going to the Doctor''s';

INSERT INTO public.conversation_characters (name, role, description, icon_name, display_order, active)
SELECT
  'Doctor',
  'Family doctor',
  'A caring doctor checking up on you.',
  'medical',
  3,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversation_characters WHERE name = 'Doctor'
);

DO $$
DECLARE
  char_id UUID;
  scenario_id UUID;
  doctor_cast_id UUID;
  player_cast_id UUID;
BEGIN
  SELECT id INTO char_id FROM public.conversation_characters WHERE name = 'Doctor';

  INSERT INTO public.conversation_scenarios (
    character_id, title, description, display_order, active, difficulty, duration_minutes
  ) VALUES (
    char_id,
    'Going to the Doctor''s',
    'Draft — pending native speaker review. Practice describing how you feel and understanding a doctor''s advice.',
    1,
    true,
    2,
    5
  ) RETURNING id INTO scenario_id;

  INSERT INTO public.conversation_exchanges (
    scenario_id, sequence_order,
    npc_setup_gurmukhi, npc_setup_romanised, npc_setup_english,
    prompt_instruction,
    target_response_gurmukhi, target_response_romanised, target_response_english,
    npc_reply_gurmukhi, npc_reply_romanised, npc_reply_english,
    is_ending,
    easy_blank_template_gurmukhi,
    easy_correct_word_gurmukhi, easy_correct_word_romanised,
    easy_option_b_gurmukhi, easy_option_b_romanised,
    easy_option_c_gurmukhi, easy_option_c_romanised,
    easy_option_d_gurmukhi, easy_option_d_romanised,
    medium_option_b_gurmukhi, medium_option_b_romanised, medium_option_b_english,
    medium_option_c_gurmukhi, medium_option_c_romanised, medium_option_c_english,
    medium_option_d_gurmukhi, medium_option_d_romanised, medium_option_d_english,
    hard_word_tiles
  ) VALUES
  (
    scenario_id, 1,
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਤਕਲੀਫ਼ ਹੈ?',
    'Sat sri akal ji, ajj tuhaanu ki takleef hai?',
    'Hello, what''s troubling you today?',
    'Say you have a fever',
    'ਮੈਨੂੰ ਬੁਖ਼ਾਰ ਹੈ',
    'Mainu bukhaar hai',
    'I have a fever',
    'ਓਹੋ, ਠੀਕ ਹੈ।',
    'Oho, theek hai.',
    'Oh, okay.',
    false,
    'ਮੈਨੂੰ ___ ਹੈ',
    'ਬੁਖ਼ਾਰ', 'bukhaar',
    'ਖ਼ੁਸ਼ੀ', 'khushi',
    'ਭੁੱਖ', 'bhukh',
    'ਨੀਂਦ', 'neend',
    'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', 'Mainu bhukh laggi hai', 'I''m hungry',
    'ਮੈਂ ਠੀਕ ਹਾਂ', 'Mai theek haa', 'I am fine',
    'ਮੈਨੂੰ ਨੀਂਦ ਆ ਰਹੀ ਹੈ', 'Mainu neend aa rahi hai', 'I''m feeling sleepy',
    '[
      {"gurmukhi": "ਮੈਨੂੰ", "romanised": "mainu", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਬੁਖ਼ਾਰ", "romanised": "bukhaar", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਭੁੱਖ", "romanised": "bhukh", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਨੀਂਦ", "romanised": "neend", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਖ਼ੁਸ਼ੀ", "romanised": "khushi", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 2,
    'ਕਦੋਂ ਤੋਂ ਬੁਖ਼ਾਰ ਹੈ?',
    'Kadon toh bukhaar hai?',
    'Since when do you have the fever?',
    'Say since yesterday',
    'ਕੱਲ੍ਹ ਤੋਂ ਬੁਖ਼ਾਰ ਹੈ',
    'Kallh toh bukhaar hai',
    'Fever since yesterday',
    'ਠੀਕ ਹੈ, ਮੈਂ ਤੁਹਾਡੀ ਜਾਂਚ ਕਰਦਾ ਹਾਂ।',
    'Theek hai, mai tuhaadi jaanch karda haa.',
    'Okay, let me examine you.',
    false,
    '___ ਤੋਂ ਬੁਖ਼ਾਰ ਹੈ',
    'ਕੱਲ੍ਹ', 'kallh',
    'ਅੱਜ', 'ajj',
    'ਹਫ਼ਤੇ', 'hafte',
    'ਸਾਲ', 'saal',
    'ਅੱਜ ਸਵੇਰ ਤੋਂ ਠੀਕ ਹਾਂ', 'Ajj savere toh theek haa', 'I''ve been fine since this morning',
    'ਮੈਨੂੰ ਕੋਈ ਤਕਲੀਫ਼ ਨਹੀਂ', 'Mainu koi takleef nahi', 'I have no problem',
    'ਦੋ ਸਾਲ ਤੋਂ', 'Do saal toh', 'Since two years',
    '[
      {"gurmukhi": "ਕੱਲ੍ਹ", "romanised": "kallh", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਤੋਂ", "romanised": "toh", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਬੁਖ਼ਾਰ", "romanised": "bukhaar", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਅੱਜ", "romanised": "ajj", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਹਫ਼ਤੇ", "romanised": "hafte", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਸਾਲ", "romanised": "saal", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 3,
    'ਕੀ ਤੁਹਾਨੂੰ ਸਿਰ ਦਰਦ ਵੀ ਹੈ?',
    'Ki tuhaanu sir dard vi hai?',
    'Do you also have a headache?',
    'Say yes, a little',
    'ਹਾਂ, ਸਿਰ ਦਰਦ ਥੋੜ੍ਹਾ ਹੈ',
    'Haa, sir dard thoda hai',
    'Yes, a little headache',
    'ਠੀਕ ਹੈ, ਘਬਰਾਉਣ ਦੀ ਲੋੜ ਨਹੀਂ।',
    'Theek hai, ghabraaun di lodh nahi.',
    'Okay, no need to worry.',
    false,
    'ਹਾਂ, ਸਿਰ ਦਰਦ ___ ਹੈ',
    'ਥੋੜ੍ਹਾ', 'thoda',
    'ਬਹੁਤ', 'bahut',
    'ਕਦੇ ਨਹੀਂ', 'kade nahi',
    'ਹਮੇਸ਼ਾ', 'hamesha',
    'ਨਹੀਂ, ਕੋਈ ਦਰਦ ਨਹੀਂ', 'Nahi, koi dard nahi', 'No, no pain',
    'ਮੈਨੂੰ ਪੇਟ ਦਰਦ ਹੈ', 'Mainu pet dard hai', 'I have a stomach ache',
    'ਮੈਨੂੰ ਖੰਘ ਹੈ', 'Mainu khangh hai', 'I have a cough',
    '[
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਸਿਰ", "romanised": "sir", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਦਰਦ", "romanised": "dard", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਥੋੜ੍ਹਾ", "romanised": "thoda", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਪੇਟ", "romanised": "pet", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਖੰਘ", "romanised": "khangh", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਹਮੇਸ਼ਾ", "romanised": "hamesha", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 4,
    'ਮੈਂ ਤੁਹਾਨੂੰ ਕੁਝ ਦਵਾਈ ਦਿੰਦਾ ਹਾਂ। ਤੁਸੀਂ ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਲੈਣੀ ਹੈ।',
    'Mai tuhaanu kujh davai dinda haa. Tusi din vich do vaar lainee hai.',
    'I''ll give you some medicine. Take it twice a day.',
    'Say okay, thank you',
    'ਠੀਕ ਹੈ ਜੀ, ਧੰਨਵਾਦ',
    'Theek hai ji, dhanvaad',
    'Okay, thank you',
    'ਕੋਈ ਗੱਲ ਨਹੀਂ, ਆਰਾਮ ਕਰੋ।',
    'Koi gall nahi, aaraam karo.',
    'No worries, rest well.',
    false,
    'ਠੀਕ ਹੈ ਜੀ, ___',
    'ਧੰਨਵਾਦ', 'dhanvaad',
    'ਅਫ਼ਸੋਸ', 'afsos',
    'ਮਾਫ਼ੀ', 'maafi',
    'ਨਮਸਤੇ', 'namaste',
    'ਮੈਨੂੰ ਦਵਾਈ ਪਸੰਦ ਨਹੀਂ', 'Mainu davai pasand nahi', 'I don''t like medicine',
    'ਮੈਂ ਹੁਣ ਜਾਵਾਂਗਾ', 'Mai hun jaavaanga', 'I will go now',
    'ਕੀ ਇਹ ਮਹਿੰਗੀ ਹੈ?', 'Ki ih mehngi hai?', 'Is it expensive?',
    '[
      {"gurmukhi": "ਠੀਕ", "romanised": "theek", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਜੀ", "romanised": "ji", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਧੰਨਵਾਦ", "romanised": "dhanvaad", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਮਹਿੰਗੀ", "romanised": "mehngi", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਮਾਫ਼ੀ", "romanised": "maafi", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਹੁਣ", "romanised": "hun", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 5,
    'ਪਾਣੀ ਬਹੁਤ ਪੀਣਾ ਅਤੇ ਪੂਰੀ ਨੀਂਦ ਲੈਣੀ।',
    'Paani bahut peenaa ate poori neend lainee.',
    'Drink lots of water and get full sleep.',
    'Say you will do that',
    'ਮੈਂ ਇਹ ਕਰਾਂਗਾ',
    'Mai ih karaanga',
    'I will do this',
    'ਬਹੁਤ ਵਧੀਆ, ਜਲਦੀ ਠੀਕ ਹੋ ਜਾਓਗੇ।',
    'Bahut vadhia, jaldi theek ho jaaoge.',
    'Very good, you''ll get better soon.',
    false,
    'ਮੈਂ ___ ਕਰਾਂਗਾ',
    'ਇਹ', 'ih',
    'ਕੰਮ', 'kaam',
    'ਖਾਣਾ', 'khana',
    'ਸਫ਼ਰ', 'safar',
    'ਮੈਂ ਨਹੀਂ ਕਰਾਂਗਾ', 'Mai nahi karaanga', 'I won''t do it',
    'ਮੈਨੂੰ ਯਾਦ ਨਹੀਂ ਰਹੇਗਾ', 'Mainu yaad nahi rahega', 'I won''t remember',
    'ਮੈਂ ਕੰਮ ''ਤੇ ਜਾਵਾਂਗਾ', 'Mai kaam te jaavaanga', 'I will go to work',
    '[
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਇਹ", "romanised": "ih", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਕਰਾਂਗਾ", "romanised": "karaanga", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਕੰਮ", "romanised": "kaam", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਖਾਣਾ", "romanised": "khana", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਸਫ਼ਰ", "romanised": "safar", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 6,
    'ਜੇ ਬੁਖ਼ਾਰ ਤਿੰਨ ਦਿਨਾਂ ਵਿੱਚ ਠੀਕ ਨਾ ਹੋਵੇ, ਵਾਪਸ ਆ ਜਾਣਾ।',
    'Je bukhaar tinn dinaa vich theek naa hove, vaapas aa jaanaa.',
    'If the fever doesn''t improve in three days, come back.',
    'Say okay, goodbye',
    'ਠੀਕ ਹੈ, ਬਹੁਤ ਧੰਨਵਾਦ, ਰੱਬ ਰਾਖਾ',
    'Theek hai, bahut dhanvaad, Rabb raakhaa',
    'Okay, thank you very much, goodbye',
    NULL, NULL, NULL,
    true,
    'ਠੀਕ ਹੈ, ___ ਧੰਨਵਾਦ',
    'ਬਹੁਤ', 'bahut',
    'ਕਦੇ', 'kade',
    'ਥੋੜ੍ਹਾ', 'thoda',
    'ਨਹੀਂ', 'nahi',
    'ਮੈਂ ਵਾਪਸ ਨਹੀਂ ਆਵਾਂਗਾ', 'Mai vaapas nahi aavaanga', 'I won''t come back',
    'ਇਹ ਕੰਮ ਨਹੀਂ ਕਰੇਗਾ', 'Ih kaam nahi karega', 'This won''t work',
    'ਮੈਨੂੰ ਹੋਰ ਦਵਾਈ ਚਾਹੀਦੀ ਹੈ', 'Mainu hor davai chahidi hai', 'I need more medicine',
    '[
      {"gurmukhi": "ਠੀਕ", "romanised": "theek", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਬਹੁਤ", "romanised": "bahut", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਧੰਨਵਾਦ", "romanised": "dhanvaad", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਰੱਬ", "romanised": "rabb", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਰਾਖਾ", "romanised": "raakhaa", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਕਦੇ", "romanised": "kade", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਹੋਰ", "romanised": "hor", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੰਮ", "romanised": "kaam", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  );

  INSERT INTO public.conversation_scenario_characters (
    scenario_id, name, role_label, is_player_role, display_order
  ) VALUES (
    scenario_id, 'Doctor', 'Family doctor', false, 0
  ) RETURNING id INTO doctor_cast_id;

  INSERT INTO public.conversation_scenario_characters (
    scenario_id, name, role_label, is_player_role, display_order
  ) VALUES (
    scenario_id, 'Simran', 'You', true, 1
  ) RETURNING id INTO player_cast_id;

  INSERT INTO public.conversation_turns (
    scenario_id, scenario_character_id, sequence_order,
    gurmukhi_text, romanised_text, english_translation, requires_audio
  ) VALUES
    (scenario_id, doctor_cast_id, 1,
     'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਅੱਜ ਤੁਹਾਨੂੰ ਕੀ ਤਕਲੀਫ਼ ਹੈ?',
     'Sat sri akal ji, ajj tuhaanu ki takleef hai?',
     'Hello, what''s troubling you today?', true),
    (scenario_id, player_cast_id, 2,
     'ਮੈਨੂੰ ਬੁਖ਼ਾਰ ਹੈ',
     'Mainu bukhaar hai',
     'I have a fever', false),
    (scenario_id, doctor_cast_id, 3,
     'ਓਹੋ, ਠੀਕ ਹੈ।',
     'Oho, theek hai.',
     'Oh, okay.', true),
    (scenario_id, doctor_cast_id, 4,
     'ਕਦੋਂ ਤੋਂ ਬੁਖ਼ਾਰ ਹੈ?',
     'Kadon toh bukhaar hai?',
     'Since when do you have the fever?', true),
    (scenario_id, player_cast_id, 5,
     'ਕੱਲ੍ਹ ਤੋਂ ਬੁਖ਼ਾਰ ਹੈ',
     'Kallh toh bukhaar hai',
     'Fever since yesterday', false),
    (scenario_id, doctor_cast_id, 6,
     'ਠੀਕ ਹੈ, ਮੈਂ ਤੁਹਾਡੀ ਜਾਂਚ ਕਰਦਾ ਹਾਂ।',
     'Theek hai, mai tuhaadi jaanch karda haa.',
     'Okay, let me examine you.', true),
    (scenario_id, doctor_cast_id, 7,
     'ਕੀ ਤੁਹਾਨੂੰ ਸਿਰ ਦਰਦ ਵੀ ਹੈ?',
     'Ki tuhaanu sir dard vi hai?',
     'Do you also have a headache?', true),
    (scenario_id, player_cast_id, 8,
     'ਹਾਂ, ਸਿਰ ਦਰਦ ਥੋੜ੍ਹਾ ਹੈ',
     'Haa, sir dard thoda hai',
     'Yes, a little headache', false),
    (scenario_id, doctor_cast_id, 9,
     'ਠੀਕ ਹੈ, ਘਬਰਾਉਣ ਦੀ ਲੋੜ ਨਹੀਂ।',
     'Theek hai, ghabraaun di lodh nahi.',
     'Okay, no need to worry.', true),
    (scenario_id, doctor_cast_id, 10,
     'ਮੈਂ ਤੁਹਾਨੂੰ ਕੁਝ ਦਵਾਈ ਦਿੰਦਾ ਹਾਂ। ਤੁਸੀਂ ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ ਲੈਣੀ ਹੈ।',
     'Mai tuhaanu kujh davai dinda haa. Tusi din vich do vaar lainee hai.',
     'I''ll give you some medicine. Take it twice a day.', true),
    (scenario_id, player_cast_id, 11,
     'ਠੀਕ ਹੈ ਜੀ, ਧੰਨਵਾਦ',
     'Theek hai ji, dhanvaad',
     'Okay, thank you', false),
    (scenario_id, doctor_cast_id, 12,
     'ਕੋਈ ਗੱਲ ਨਹੀਂ, ਆਰਾਮ ਕਰੋ।',
     'Koi gall nahi, aaraam karo.',
     'No worries, rest well.', true),
    (scenario_id, doctor_cast_id, 13,
     'ਪਾਣੀ ਬਹੁਤ ਪੀਣਾ ਅਤੇ ਪੂਰੀ ਨੀਂਦ ਲੈਣੀ।',
     'Paani bahut peenaa ate poori neend lainee.',
     'Drink lots of water and get full sleep.', true),
    (scenario_id, player_cast_id, 14,
     'ਮੈਂ ਇਹ ਕਰਾਂਗਾ',
     'Mai ih karaanga',
     'I will do this', false),
    (scenario_id, doctor_cast_id, 15,
     'ਬਹੁਤ ਵਧੀਆ, ਜਲਦੀ ਠੀਕ ਹੋ ਜਾਓਗੇ।',
     'Bahut vadhia, jaldi theek ho jaaoge.',
     'Very good, you''ll get better soon.', true),
    (scenario_id, doctor_cast_id, 16,
     'ਜੇ ਬੁਖ਼ਾਰ ਤਿੰਨ ਦਿਨਾਂ ਵਿੱਚ ਠੀਕ ਨਾ ਹੋਵੇ, ਵਾਪਸ ਆ ਜਾਣਾ।',
     'Je bukhaar tinn dinaa vich theek naa hove, vaapas aa jaanaa.',
     'If the fever doesn''t improve in three days, come back.', true),
    (scenario_id, player_cast_id, 17,
     'ਠੀਕ ਹੈ, ਬਹੁਤ ਧੰਨਵਾਦ, ਰੱਬ ਰਾਖਾ',
     'Theek hai, bahut dhanvaad, Rabb raakhaa',
     'Okay, thank you very much, goodbye', false);

END $$;

NOTIFY pgrst, 'reload schema';
