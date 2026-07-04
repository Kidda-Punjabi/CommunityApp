-- =============================================================================
-- Kidda — Conversation Practice seed: Meeting a New Neighbour (scenario 1 of 4)
-- Run in Supabase SQL Editor AFTER:
--   conversation-practice.sql
--   conversation-practice-turns.sql
--
-- Idempotent: deletes scenario by title (cascades exchanges, cast, turns),
-- then re-inserts. Global character "Neighbour" is upserted by name.
--
-- Status: DRAFT — pending native-speaker review before production use.
-- =============================================================================

DELETE FROM public.conversation_scenarios
WHERE title = 'Meeting a New Neighbour';

INSERT INTO public.conversation_characters (name, role, description, icon_name, display_order, active)
SELECT
  'Neighbour',
  'Local resident',
  'A friendly neighbour who just introduced themselves.',
  'home',
  2,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversation_characters WHERE name = 'Neighbour'
);

DO $$
DECLARE
  char_id UUID;
  scenario_id UUID;
  neighbour_cast_id UUID;
  player_cast_id UUID;
BEGIN
  SELECT id INTO char_id FROM public.conversation_characters WHERE name = 'Neighbour';

  INSERT INTO public.conversation_scenarios (
    character_id, title, description, display_order, active, difficulty, duration_minutes
  ) VALUES (
    char_id,
    'Meeting a New Neighbour',
    'Draft — pending native speaker review. Practice introducing yourself when you move somewhere new.',
    1,
    true,
    2,
    5
  ) RETURNING id INTO scenario_id;

  -- -------------------------------------------------------------------------
  -- Legacy learner exchanges (easy / medium / hard)
  -- -------------------------------------------------------------------------

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
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ ਤੁਹਾਡਾ ਨਵਾਂ ਗੁਆਂਢੀ ਹਾਂ।',
    'Sat sri akal ji! Mai tuhaada navaa guandhi haa.',
    'Hello! I''m your new neighbour.',
    'Greet back and tell them your name',
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੇਰਾ ਨਾਂ ਸਿਮਰਨ ਹੈ',
    'Sat sri akal ji, mera naa Simran hai',
    'Hello, my name is Simran',
    'ਬਹੁਤ ਵਧੀਆ, ਸਿਮਰਨ ਜੀ! ਮਿਲ ਕੇ ਖੁਸ਼ੀ ਹੋਈ।',
    'Bahut vadhia, Simran ji! Mil ke khushi hoi.',
    'Very nice, Simran ji! Nice to meet you.',
    false,
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੇਰਾ ___ ਸਿਮਰਨ ਹੈ',
    'ਨਾਂ', 'naa',
    'ਘਰ', 'ghar',
    'ਕੰਮ', 'kaam',
    'ਦੋਸਤ', 'dost',
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', 'Sat sri akal ji, mainu bhukh laggi hai', 'Hello, I''m hungry',
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੈਂ ਥੱਕਿਆ ਹਾਂ', 'Sat sri akal ji, mai thakkiya haa', 'Hello, I''m tired',
    'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਇਹ ਮੇਰਾ ਘਰ ਹੈ', 'Sat sri akal ji, ih mera ghar hai', 'Hello, this is my house',
    '[
      {"gurmukhi": "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ", "romanised": "Sat sri akal ji", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਮੇਰਾ", "romanised": "mera", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਨਾਂ", "romanised": "naa", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਸਿਮਰਨ", "romanised": "Simran", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਘਰ", "romanised": "ghar", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਦੋਸਤ", "romanised": "dost", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਨਹੀਂ", "romanised": "nahi", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 2,
    'ਤੁਸੀਂ ਕਦੋਂ ਇਸ ਘਰ ਵਿੱਚ ਆਏ ਹੋ?',
    'Tusi kadon is ghar vich aae ho?',
    'When did you move into this house?',
    'Say you moved in last week',
    'ਮੈਂ ਪਿਛਲੇ ਹਫ਼ਤੇ ਆਇਆ ਹਾਂ',
    'Mai pichhle hafte aaiya haa',
    'I came last week',
    'ਚੰਗਾ ਹੈ, ਸਾਡਾ ਆਂਢ-ਗੁਆਂਢ ਬਹੁਤ ਦੋਸਤਾਨਾ ਹੈ।',
    'Changa hai, saadaa aandh-guandh bahut dostaanaa hai.',
    'Good, our neighbourhood is very friendly.',
    false,
    'ਮੈਂ ___ ਹਫ਼ਤੇ ਆਇਆ ਹਾਂ',
    'ਪਿਛਲੇ', 'pichhle',
    'ਅਗਲੇ', 'agle',
    'ਇਸ', 'is',
    'ਹਰ', 'har',
    'ਮੈਂ ਕੱਲ੍ਹ ਜਾਵਾਂਗਾ', 'Mai kallh jaavaanga', 'I will go tomorrow',
    'ਮੈਂ ਬਹੁਤ ਥੱਕਿਆ ਹਾਂ', 'Mai bahut thakkiya haa', 'I am very tired',
    'ਮੈਂ ਦੁਕਾਨ ''ਤੇ ਗਿਆ', 'Mai dukaan te giya', 'I went to the shop',
    '[
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਪਿਛਲੇ", "romanised": "pichhle", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਹਫ਼ਤੇ", "romanised": "hafte", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਆਇਆ", "romanised": "aaiya", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਅਗਲੇ", "romanised": "agle", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੱਲ੍ਹ", "romanised": "kallh", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਦੁਕਾਨ", "romanised": "dukaan", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 3,
    'ਕੀ ਤੁਸੀਂ ਇਕੱਲੇ ਰਹਿੰਦੇ ਹੋ ਜਾਂ ਪਰਿਵਾਰ ਨਾਲ?',
    'Ki tusi ikalle rehnde ho jaan parivar naal?',
    'Do you live alone or with family?',
    'Say you live with your family',
    'ਮੈਂ ਆਪਣੇ ਪਰਿਵਾਰ ਨਾਲ ਰਹਿੰਦਾ ਹਾਂ',
    'Mai apne parivar naal rehnda haa',
    'I live with my family',
    'ਬਹੁਤ ਵਧੀਆ! ਪਰਿਵਾਰ ਨਾਲ ਰਹਿਣਾ ਚੰਗਾ ਹੁੰਦਾ ਹੈ।',
    'Bahut vadhia! Parivar naal rehnaa changa hunda hai.',
    'Very nice! Living with family is good.',
    false,
    'ਮੈਂ ਆਪਣੇ ___ ਨਾਲ ਰਹਿੰਦਾ ਹਾਂ',
    'ਪਰਿਵਾਰ', 'parivar',
    'ਦੋਸਤ', 'dost',
    'ਕੁੱਤੇ', 'kutte',
    'ਸਕੂਲ', 'school',
    'ਮੈਂ ਇਕੱਲਾ ਰਹਿੰਦਾ ਹਾਂ', 'Mai ikallaa rehnda haa', 'I live alone',
    'ਮੈਂ ਦੋਸਤਾਂ ਨਾਲ ਖੇਡਦਾ ਹਾਂ', 'Mai dostaa naal khedda haa', 'I play with friends',
    'ਮੈਂ ਕੰਮ ''ਤੇ ਜਾਂਦਾ ਹਾਂ', 'Mai kaam te jaanda haa', 'I go to work',
    '[
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਆਪਣੇ", "romanised": "apne", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਪਰਿਵਾਰ", "romanised": "parivar", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਨਾਲ", "romanised": "naal", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਰਹਿੰਦਾ", "romanised": "rehnda", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਇਕੱਲਾ", "romanised": "ikallaa", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਦੋਸਤਾਂ", "romanised": "dostaa", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੰਮ", "romanised": "kaam", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 4,
    'ਜੇ ਤੁਹਾਨੂੰ ਕਿਸੇ ਚੀਜ਼ ਦੀ ਲੋੜ ਹੋਵੇ, ਮੈਨੂੰ ਦੱਸਣਾ।',
    'Je tuhaanu kise cheez di lodh hove, mainu dassnaa.',
    'If you need anything, let me know.',
    'Thank them',
    'ਬਹੁਤ ਧੰਨਵਾਦ ਜੀ, ਤੁਸੀਂ ਦਿਆਲੂ ਹੋ',
    'Bahut dhanvaad ji, tusi diaaloo ho',
    'Thank you very much, you''re kind',
    'ਕੋਈ ਗੱਲ ਨਹੀਂ, ਫਿਰ ਮਿਲਾਂਗੇ।',
    'Koi gall nahi, phir milaange.',
    'No worries, see you again.',
    false,
    '___ ਧੰਨਵਾਦ ਜੀ',
    'ਬਹੁਤ', 'bahut',
    'ਕਦੇ', 'kade',
    'ਥੋੜ੍ਹਾ', 'thoda',
    'ਨਹੀਂ', 'nahi',
    'ਮੈਨੂੰ ਕੋਈ ਲੋੜ ਨਹੀਂ', 'Mainu koi lodh nahi', 'I don''t need anything',
    'ਮੈਂ ਬਹੁਤ ਵਿਅਸਤ ਹਾਂ', 'Mai bahut viast haa', 'I''m very busy',
    'ਇਹ ਠੀਕ ਨਹੀਂ ਹੈ', 'Ih theek nahi hai', 'This isn''t right',
    '[
      {"gurmukhi": "ਬਹੁਤ", "romanised": "bahut", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਧੰਨਵਾਦ", "romanised": "dhanvaad", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਜੀ", "romanised": "ji", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਤੁਸੀਂ", "romanised": "tusi", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਦਿਆਲੂ", "romanised": "diaaloo", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਹੋ", "romanised": "ho", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਕਦੇ", "romanised": "kade", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਵਿਅਸਤ", "romanised": "viast", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਠੀਕ", "romanised": "theek", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 5,
    'ਕੀ ਤੁਹਾਡੇ ਬੱਚੇ ਹਨ? ਮੇਰੇ ਬੱਚੇ ਵੀ ਇੱਥੇ ਖੇਡਦੇ ਹਨ।',
    'Ki tuhaade bacche han? Mere bacche vi itthe khedde han.',
    'Do you have kids? My kids also play here.',
    'Say yes, you have one daughter',
    'ਹਾਂ, ਮੇਰੀ ਇੱਕ ਧੀ ਹੈ',
    'Haa, meri ik dhee hai',
    'Yes, I have one daughter',
    'ਬਹੁਤ ਵਧੀਆ! ਉਹ ਮੇਰੇ ਬੱਚਿਆਂ ਨਾਲ ਖੇਡ ਸਕਦੀ ਹੈ।',
    'Bahut vadhia! Oh mere bacchiaa naal khed sakdi hai.',
    'Great! She can play with my kids.',
    false,
    'ਹਾਂ, ਮੇਰੀ ਇੱਕ ___ ਹੈ',
    'ਧੀ', 'dhee',
    'ਭੈਣ', 'bhain',
    'ਗੱਡੀ', 'gaddi',
    'ਦੁਕਾਨ', 'dukaan',
    'ਨਹੀਂ, ਮੇਰੇ ਕੋਈ ਬੱਚੇ ਨਹੀਂ ਹਨ', 'Nahi, mere koi bacche nahi han', 'No, I don''t have any kids',
    'ਮੇਰੇ ਦੋ ਕੁੱਤੇ ਹਨ', 'Mere do kutte han', 'I have two dogs',
    'ਮੈਂ ਵੀ ਖੇਡਣਾ ਪਸੰਦ ਕਰਦਾ ਹਾਂ', 'Mai vi khedna pasand karda haa', 'I also like to play',
    '[
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਮੇਰੀ", "romanised": "meri", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਇੱਕ", "romanised": "ik", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਧੀ", "romanised": "dhee", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਭੈਣ", "romanised": "bhain", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੁੱਤੇ", "romanised": "kutte", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਨਹੀਂ", "romanised": "nahi", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 6,
    'ਚੰਗਾ ਜੀ, ਮੈਨੂੰ ਹੁਣ ਜਾਣਾ ਪਵੇਗਾ। ਫਿਰ ਮਿਲਾਂਗੇ!',
    'Changa ji, mainu hun jaanaa pavega. Phir milaange!',
    'Okay, I have to go now. See you soon!',
    'Say goodbye',
    'ਠੀਕ ਹੈ, ਫਿਰ ਮਿਲਾਂਗੇ, ਰੱਬ ਰਾਖਾ',
    'Theek hai, phir milaange, Rabb raakhaa',
    'Okay, see you again, goodbye',
    NULL, NULL, NULL,
    true,
    'ਠੀਕ ਹੈ, ___ ਮਿਲਾਂਗੇ',
    'ਫਿਰ', 'phir',
    'ਕਦੇ', 'kade',
    'ਹੁਣ', 'hun',
    'ਨਹੀਂ', 'nahi',
    'ਨਹੀਂ, ਮੈਂ ਨਹੀਂ ਜਾਣਾ ਚਾਹੁੰਦਾ', 'Nahi, mai nahi jaanaa chahunda', 'No, I don''t want to go',
    'ਤੁਸੀਂ ਕੌਣ ਹੋ?', 'Tusi kaun ho?', 'Who are you?',
    'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', 'Mainu bhukh laggi hai', 'I''m hungry',
    '[
      {"gurmukhi": "ਠੀਕ", "romanised": "theek", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਫਿਰ", "romanised": "phir", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਮਿਲਾਂਗੇ", "romanised": "milaange", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਰੱਬ", "romanised": "rabb", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਰਾਖਾ", "romanised": "raakhaa", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਕਦੇ", "romanised": "kade", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਭੁੱਖ", "romanised": "bhukh", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੌਣ", "romanised": "kaun", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  );

  -- -------------------------------------------------------------------------
  -- Admin turns model (NPC audio pipeline)
  -- -------------------------------------------------------------------------

  INSERT INTO public.conversation_scenario_characters (
    scenario_id, name, role_label, is_player_role, display_order
  ) VALUES (
    scenario_id, 'Neighbour', 'Local resident', false, 0
  ) RETURNING id INTO neighbour_cast_id;

  INSERT INTO public.conversation_scenario_characters (
    scenario_id, name, role_label, is_player_role, display_order
  ) VALUES (
    scenario_id, 'Simran', 'You', true, 1
  ) RETURNING id INTO player_cast_id;

  INSERT INTO public.conversation_turns (
    scenario_id, scenario_character_id, sequence_order,
    gurmukhi_text, romanised_text, english_translation, requires_audio
  ) VALUES
    (scenario_id, neighbour_cast_id, 1,
     'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਮੈਂ ਤੁਹਾਡਾ ਨਵਾਂ ਗੁਆਂਢੀ ਹਾਂ।',
     'Sat sri akal ji! Mai tuhaada navaa guandhi haa.',
     'Hello! I''m your new neighbour.', true),
    (scenario_id, player_cast_id, 2,
     'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ਜੀ, ਮੇਰਾ ਨਾਂ ਸਿਮਰਨ ਹੈ',
     'Sat sri akal ji, mera naa Simran hai',
     'Hello, my name is Simran', false),
    (scenario_id, neighbour_cast_id, 3,
     'ਬਹੁਤ ਵਧੀਆ, ਸਿਮਰਨ ਜੀ! ਮਿਲ ਕੇ ਖੁਸ਼ੀ ਹੋਈ।',
     'Bahut vadhia, Simran ji! Mil ke khushi hoi.',
     'Very nice, Simran ji! Nice to meet you.', true),
    (scenario_id, neighbour_cast_id, 4,
     'ਤੁਸੀਂ ਕਦੋਂ ਇਸ ਘਰ ਵਿੱਚ ਆਏ ਹੋ?',
     'Tusi kadon is ghar vich aae ho?',
     'When did you move into this house?', true),
    (scenario_id, player_cast_id, 5,
     'ਮੈਂ ਪਿਛਲੇ ਹਫ਼ਤੇ ਆਇਆ ਹਾਂ',
     'Mai pichhle hafte aaiya haa',
     'I came last week', false),
    (scenario_id, neighbour_cast_id, 6,
     'ਚੰਗਾ ਹੈ, ਸਾਡਾ ਆਂਢ-ਗੁਆਂਢ ਬਹੁਤ ਦੋਸਤਾਨਾ ਹੈ।',
     'Changa hai, saadaa aandh-guandh bahut dostaanaa hai.',
     'Good, our neighbourhood is very friendly.', true),
    (scenario_id, neighbour_cast_id, 7,
     'ਕੀ ਤੁਸੀਂ ਇਕੱਲੇ ਰਹਿੰਦੇ ਹੋ ਜਾਂ ਪਰਿਵਾਰ ਨਾਲ?',
     'Ki tusi ikalle rehnde ho jaan parivar naal?',
     'Do you live alone or with family?', true),
    (scenario_id, player_cast_id, 8,
     'ਮੈਂ ਆਪਣੇ ਪਰਿਵਾਰ ਨਾਲ ਰਹਿੰਦਾ ਹਾਂ',
     'Mai apne parivar naal rehnda haa',
     'I live with my family', false),
    (scenario_id, neighbour_cast_id, 9,
     'ਬਹੁਤ ਵਧੀਆ! ਪਰਿਵਾਰ ਨਾਲ ਰਹਿਣਾ ਚੰਗਾ ਹੁੰਦਾ ਹੈ।',
     'Bahut vadhia! Parivar naal rehnaa changa hunda hai.',
     'Very nice! Living with family is good.', true),
    (scenario_id, neighbour_cast_id, 10,
     'ਜੇ ਤੁਹਾਨੂੰ ਕਿਸੇ ਚੀਜ਼ ਦੀ ਲੋੜ ਹੋਵੇ, ਮੈਨੂੰ ਦੱਸਣਾ।',
     'Je tuhaanu kise cheez di lodh hove, mainu dassnaa.',
     'If you need anything, let me know.', true),
    (scenario_id, player_cast_id, 11,
     'ਬਹੁਤ ਧੰਨਵਾਦ ਜੀ, ਤੁਸੀਂ ਦਿਆਲੂ ਹੋ',
     'Bahut dhanvaad ji, tusi diaaloo ho',
     'Thank you very much, you''re kind', false),
    (scenario_id, neighbour_cast_id, 12,
     'ਕੋਈ ਗੱਲ ਨਹੀਂ, ਫਿਰ ਮਿਲਾਂਗੇ।',
     'Koi gall nahi, phir milaange.',
     'No worries, see you again.', true),
    (scenario_id, neighbour_cast_id, 13,
     'ਕੀ ਤੁਹਾਡੇ ਬੱਚੇ ਹਨ? ਮੇਰੇ ਬੱਚੇ ਵੀ ਇੱਥੇ ਖੇਡਦੇ ਹਨ।',
     'Ki tuhaade bacche han? Mere bacche vi itthe khedde han.',
     'Do you have kids? My kids also play here.', true),
    (scenario_id, player_cast_id, 14,
     'ਹਾਂ, ਮੇਰੀ ਇੱਕ ਧੀ ਹੈ',
     'Haa, meri ik dhee hai',
     'Yes, I have one daughter', false),
    (scenario_id, neighbour_cast_id, 15,
     'ਬਹੁਤ ਵਧੀਆ! ਉਹ ਮੇਰੇ ਬੱਚਿਆਂ ਨਾਲ ਖੇਡ ਸਕਦੀ ਹੈ।',
     'Bahut vadhia! Oh mere bacchiaa naal khed sakdi hai.',
     'Great! She can play with my kids.', true),
    (scenario_id, neighbour_cast_id, 16,
     'ਚੰਗਾ ਜੀ, ਮੈਨੂੰ ਹੁਣ ਜਾਣਾ ਪਵੇਗਾ। ਫਿਰ ਮਿਲਾਂਗੇ!',
     'Changa ji, mainu hun jaanaa pavega. Phir milaange!',
     'Okay, I have to go now. See you soon!', true),
    (scenario_id, player_cast_id, 17,
     'ਠੀਕ ਹੈ, ਫਿਰ ਮਿਲਾਂਗੇ, ਰੱਬ ਰਾਖਾ',
     'Theek hai, phir milaange, Rabb raakhaa',
     'Okay, see you again, goodbye', false);

END $$;

NOTIFY pgrst, 'reload schema';
