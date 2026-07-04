-- =============================================================================
-- Kidda — Conversation Practice seed: Speaking to Your Grandmother (scenario 3 of 4)
-- Run in Supabase SQL Editor AFTER:
--   conversation-practice.sql
--   conversation-practice-turns.sql
--
-- Idempotent: deletes scenario by title (cascades exchanges, cast, turns),
-- then re-inserts. Global character "Daadi ji" is upserted by name.
--
-- Status: DRAFT — pending native-speaker review before production use.
-- Register note: respectful tusi form throughout; grandmother uses puttar (son).
-- =============================================================================

DELETE FROM public.conversation_scenarios
WHERE title = 'Speaking to Your Grandmother';

INSERT INTO public.conversation_characters (name, role, description, icon_name, display_order, active)
SELECT
  'Daadi ji',
  'Grandmother',
  'Your loving grandmother, always happy to hear from you.',
  'grandmother',
  4,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.conversation_characters WHERE name = 'Daadi ji'
);

DO $$
DECLARE
  char_id UUID;
  scenario_id UUID;
  daadi_cast_id UUID;
  player_cast_id UUID;
BEGIN
  SELECT id INTO char_id FROM public.conversation_characters WHERE name = 'Daadi ji';

  INSERT INTO public.conversation_scenarios (
    character_id, title, description, display_order, active, difficulty, duration_minutes
  ) VALUES (
    char_id,
    'Speaking to Your Grandmother',
    'Draft — pending native speaker review. Practice a warm phone call with your grandmother in Punjabi.',
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
    'ਹੈਲੋ ਪੁੱਤਰ, ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਕਿਵੇਂ ਹੋ ਤੁਸੀਂ?',
    'Hello puttar, Sat sri akal! Kiven ho tusi?',
    'Hello son, Sat sri akal! How are you?',
    'Say you are fine and ask how she is',
    'ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
    'Mai theek haa, tusi kiven ho?',
    'I''m fine, how are you?',
    'ਮੈਂ ਵੀ ਠੀਕ ਹਾਂ, ਪੁੱਤਰ। ਤੇਰੀ ਬਹੁਤ ਯਾਦ ਆਉਂਦੀ ਹੈ।',
    'Mai vi theek haa, puttar. Teri bahut yaad aaundi hai.',
    'I''m fine too, son. I miss you a lot.',
    false,
    'ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ___ ਹੋ?',
    'ਕਿਵੇਂ', 'kiven',
    'ਕਿੱਥੇ', 'kitthe',
    'ਕਦੋਂ', 'kadon',
    'ਕੌਣ', 'kaun',
    'ਮੈਨੂੰ ਭੁੱਖ ਲੱਗੀ ਹੈ', 'Mainu bhukh laggi hai', 'I''m hungry',
    'ਮੈਂ ਬਾਹਰ ਹਾਂ', 'Mai baahar haa', 'I''m outside',
    'ਤੁਸੀਂ ਕੌਣ ਹੋ?', 'Tusi kaun ho?', 'Who are you?',
    '[
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਠੀਕ", "romanised": "theek", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਤੁਸੀਂ", "romanised": "tusi", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਕਿਵੇਂ", "romanised": "kiven", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਹੋ", "romanised": "ho", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਭੁੱਖ", "romanised": "bhukh", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਬਾਹਰ", "romanised": "baahar", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੌਣ", "romanised": "kaun", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 2,
    'ਤੁਸੀਂ ਪੰਜਾਬੀ ਕਿਵੇਂ ਸਿੱਖ ਰਹੇ ਹੋ?',
    'Tusi Punjabi kiven sikh rahe ho?',
    'How are you learning Punjabi?',
    'Say you''re learning with an app',
    'ਮੈਂ ਇੱਕ ਐਪ ਨਾਲ ਸਿੱਖ ਰਿਹਾ ਹਾਂ',
    'Mai ik app naal sikh rihaa haa',
    'I''m learning with an app',
    'ਵਾਹ! ਮੈਨੂੰ ਬਹੁਤ ਖ਼ੁਸ਼ੀ ਹੋਈ।',
    'Vaah! Mainu bahut khushi hoi.',
    'Wow! I''m very happy.',
    false,
    'ਮੈਂ ਇੱਕ ___ ਨਾਲ ਸਿੱਖ ਰਿਹਾ ਹਾਂ',
    'ਐਪ', 'app',
    'ਦੋਸਤ', 'dost',
    'ਕਿਤਾਬ', 'kitaab',
    'ਅਧਿਆਪਕ', 'adhiapak',
    'ਮੈਂ ਸਕੂਲ ਵਿੱਚ ਸਿੱਖਦਾ ਹਾਂ', 'Mai school vich sikhda haa', 'I learn at school',
    'ਮੈਨੂੰ ਪੰਜਾਬੀ ਨਹੀਂ ਆਉਂਦੀ', 'Mainu Punjabi nahi aaundi', 'I don''t know Punjabi',
    'ਮੈਂ ਟੀਵੀ ਦੇਖਦਾ ਹਾਂ', 'Mai TV dekhda haa', 'I watch TV',
    '[
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਇੱਕ", "romanised": "ik", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਐਪ", "romanised": "app", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਨਾਲ", "romanised": "naal", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਸਿੱਖ", "romanised": "sikh", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਰਿਹਾ", "romanised": "rihaa", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 6, "is_distractor": false},
      {"gurmukhi": "ਸਕੂਲ", "romanised": "school", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਟੀਵੀ", "romanised": "TV", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕਿਤਾਬ", "romanised": "kitaab", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 3,
    'ਕੀ ਤੁਸੀਂ ਮੇਰੇ ਲਈ ਕੁਝ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹੋ?',
    'Ki tusi mere lai kujh Punjabi bol sakde ho?',
    'Can you speak some Punjabi for me?',
    'Say yes, a little bit',
    'ਹਾਂ, ਥੋੜ੍ਹਾ ਬੋਲ ਸਕਦਾ ਹਾਂ',
    'Haa, thoda bol sakda haa',
    'Yes, I can speak a little',
    'ਸ਼ਾਬਾਸ਼! ਤੁਸੀਂ ਬਹੁਤ ਵਧੀਆ ਬੋਲਦੇ ਹੋ।',
    'Shaabaash! Tusi bahut vadhia bolde ho.',
    'Well done! You speak very well.',
    false,
    'ਹਾਂ, ___ ਬੋਲ ਸਕਦਾ ਹਾਂ',
    'ਥੋੜ੍ਹਾ', 'thoda',
    'ਬਹੁਤ', 'bahut',
    'ਕਦੇ ਨਹੀਂ', 'kade nahi',
    'ਹਮੇਸ਼ਾ', 'hamesha',
    'ਨਹੀਂ, ਮੈਨੂੰ ਨਹੀਂ ਆਉਂਦੀ', 'Nahi, mainu nahi aaundi', 'No, I don''t know it',
    'ਮੈਂ ਅੰਗਰੇਜ਼ੀ ਬੋਲਦਾ ਹਾਂ', 'Mai angrezi bolda haa', 'I speak English',
    'ਮੈਨੂੰ ਸ਼ਰਮ ਆਉਂਦੀ ਹੈ', 'Mainu sharam aaundi hai', 'I feel shy',
    '[
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਥੋੜ੍ਹਾ", "romanised": "thoda", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਬੋਲ", "romanised": "bol", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਸਕਦਾ", "romanised": "sakda", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਬਹੁਤ", "romanised": "bahut", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਅੰਗਰੇਜ਼ੀ", "romanised": "angrezi", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਸ਼ਰਮ", "romanised": "sharam", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 4,
    'ਅਗਲੀ ਵਾਰ ਜਦੋਂ ਤੁਸੀਂ ਆਓਗੇ, ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਪਿੰਨੀਆਂ ਬਣਾਵਾਂਗੀ।',
    'Agli vaar jadoh tusi aaoge, mai tuhaade lai piniaa banaavaangi.',
    'Next time you visit, I''ll make pinni (sweets) for you.',
    'Say you can''t wait',
    'ਮੈਨੂੰ ਬਹੁਤ ਉਡੀਕ ਹੈ',
    'Mainu bahut udeek hai',
    'I can''t wait',
    'ਬਹੁਤ ਵਧੀਆ, ਪੁੱਤਰ! ਮੈਂ ਵੀ ਉਡੀਕਾਂਗੀ।',
    'Bahut vadhia, puttar! Mai vi udeekaangi.',
    'Wonderful, son! I''ll be waiting too.',
    false,
    'ਮੈਨੂੰ ਬਹੁਤ ___ ਹੈ',
    'ਉਡੀਕ', 'udeek',
    'ਖ਼ੁਸ਼ੀ', 'khushi',
    'ਭੁੱਖ', 'bhukh',
    'ਸ਼ਰਮ', 'sharam',
    'ਮੈਨੂੰ ਪਿੰਨੀਆਂ ਪਸੰਦ ਨਹੀਂ', 'Mainu piniaa pasand nahi', 'I don''t like pinni',
    'ਮੈਂ ਨਹੀਂ ਆ ਸਕਾਂਗਾ', 'Mai nahi aa sakaanga', 'I won''t be able to come',
    'ਮੈਂ ਬਹੁਤ ਵਿਅਸਤ ਹਾਂ', 'Mai bahut viast haa', 'I''m very busy',
    '[
      {"gurmukhi": "ਮੈਨੂੰ", "romanised": "mainu", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਬਹੁਤ", "romanised": "bahut", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਉਡੀਕ", "romanised": "udeek", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਹੈ", "romanised": "hai", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਭੁੱਖ", "romanised": "bhukh", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਵਿਅਸਤ", "romanised": "viast", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਸ਼ਰਮ", "romanised": "sharam", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 5,
    'ਆਪਣੇ ਮਾਤਾ-ਪਿਤਾ ਦਾ ਖ਼ਿਆਲ ਰੱਖਣਾ।',
    'Apne mata-pita da khiaal rakkhnaa.',
    'Take care of your parents.',
    'Say you will',
    'ਮੈਂ ਖ਼ਿਆਲ ਰੱਖਾਂਗਾ',
    'Mai khiaal rakhaanga',
    'I will take care',
    'ਸ਼ਾਬਾਸ਼, ਪੁੱਤਰ। ਰੱਬ ਤੁਹਾਡਾ ਭਲਾ ਕਰੇ।',
    'Shaabaash, puttar. Rabb tuhaadaa bhalaa kare.',
    'Well done, son. God bless you.',
    false,
    'ਮੈਂ ___ ਰੱਖਾਂਗਾ',
    'ਖ਼ਿਆਲ', 'khiaal',
    'ਕੰਮ', 'kaam',
    'ਸਮਾਂ', 'samaa',
    'ਸਾਮਾਨ', 'saamaan',
    'ਮੈਂ ਭੁੱਲ ਜਾਵਾਂਗਾ', 'Mai bhul jaavaanga', 'I will forget',
    'ਮੈਨੂੰ ਸਮਾਂ ਨਹੀਂ ਹੈ', 'Mainu samaa nahi hai', 'I don''t have time',
    'ਉਹ ਖ਼ੁਦ ਕਰ ਲੈਣਗੇ', 'Oh khud kar lainge', 'They''ll do it themselves',
    '[
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਖ਼ਿਆਲ", "romanised": "khiaal", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਰੱਖਾਂਗਾ", "romanised": "rakhaanga", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਕੰਮ", "romanised": "kaam", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਸਮਾਂ", "romanised": "samaa", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਭੁੱਲ", "romanised": "bhul", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  ),
  (
    scenario_id, 6,
    'ਚੰਗਾ ਪੁੱਤਰ, ਹੁਣ ਫ਼ੋਨ ਰੱਖਦੇ ਹਾਂ। ਆਪਣਾ ਖ਼ਿਆਲ ਰੱਖਣਾ।',
    'Changa puttar, hun phone rakhde haa. Apnaa khiaal rakkhnaa.',
    'Okay son, let''s hang up now. Take care of yourself.',
    'Say goodbye, I love you',
    'ਰੱਬ ਰਾਖਾ, ਮੈਂ ਤੁਹਾਨੂੰ ਪਿਆਰ ਕਰਦਾ ਹਾਂ',
    'Rabb raakhaa, mai tuhaanu piyaar karda haa',
    'Goodbye, I love you',
    NULL, NULL, NULL,
    true,
    'ਰੱਬ ਰਾਖਾ, ਮੈਂ ਤੁਹਾਨੂੰ ___ ਕਰਦਾ ਹਾਂ',
    'ਪਿਆਰ', 'piyaar',
    'ਕੰਮ', 'kaam',
    'ਯਾਦ', 'yaad',
    'ਫ਼ੋਨ', 'phone',
    'ਠੀਕ ਹੈ, ਅਲਵਿਦਾ', 'Theek hai, alvidaa', 'Okay, farewell',
    'ਮੈਨੂੰ ਜਾਣਾ ਪਵੇਗਾ', 'Mainu jaanaa pavega', 'I have to go',
    'ਤੁਸੀਂ ਕੌਣ ਹੋ?', 'Tusi kaun ho?', 'Who are you?',
    '[
      {"gurmukhi": "ਰੱਬ", "romanised": "rabb", "correct_position": 0, "is_distractor": false},
      {"gurmukhi": "ਰਾਖਾ", "romanised": "raakhaa", "correct_position": 1, "is_distractor": false},
      {"gurmukhi": "ਮੈਂ", "romanised": "mai", "correct_position": 2, "is_distractor": false},
      {"gurmukhi": "ਤੁਹਾਨੂੰ", "romanised": "tuhaanu", "correct_position": 3, "is_distractor": false},
      {"gurmukhi": "ਪਿਆਰ", "romanised": "piyaar", "correct_position": 4, "is_distractor": false},
      {"gurmukhi": "ਕਰਦਾ", "romanised": "karda", "correct_position": 5, "is_distractor": false},
      {"gurmukhi": "ਹਾਂ", "romanised": "haa", "correct_position": 6, "is_distractor": false},
      {"gurmukhi": "ਯਾਦ", "romanised": "yaad", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਅਲਵਿਦਾ", "romanised": "alvidaa", "correct_position": 0, "is_distractor": true},
      {"gurmukhi": "ਕੌਣ", "romanised": "kaun", "correct_position": 0, "is_distractor": true}
    ]'::jsonb
  );

  INSERT INTO public.conversation_scenario_characters (
    scenario_id, name, role_label, is_player_role, display_order
  ) VALUES (
    scenario_id, 'Daadi ji', 'Grandmother', false, 0
  ) RETURNING id INTO daadi_cast_id;

  INSERT INTO public.conversation_scenario_characters (
    scenario_id, name, role_label, is_player_role, display_order
  ) VALUES (
    scenario_id, 'Simran', 'You', true, 1
  ) RETURNING id INTO player_cast_id;

  INSERT INTO public.conversation_turns (
    scenario_id, scenario_character_id, sequence_order,
    gurmukhi_text, romanised_text, english_translation, requires_audio
  ) VALUES
    (scenario_id, daadi_cast_id, 1,
     'ਹੈਲੋ ਪੁੱਤਰ, ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਕਿਵੇਂ ਹੋ ਤੁਸੀਂ?',
     'Hello puttar, Sat sri akal! Kiven ho tusi?',
     'Hello son, Sat sri akal! How are you?', true),
    (scenario_id, player_cast_id, 2,
     'ਮੈਂ ਠੀਕ ਹਾਂ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?',
     'Mai theek haa, tusi kiven ho?',
     'I''m fine, how are you?', false),
    (scenario_id, daadi_cast_id, 3,
     'ਮੈਂ ਵੀ ਠੀਕ ਹਾਂ, ਪੁੱਤਰ। ਤੇਰੀ ਬਹੁਤ ਯਾਦ ਆਉਂਦੀ ਹੈ।',
     'Mai vi theek haa, puttar. Teri bahut yaad aaundi hai.',
     'I''m fine too, son. I miss you a lot.', true),
    (scenario_id, daadi_cast_id, 4,
     'ਤੁਸੀਂ ਪੰਜਾਬੀ ਕਿਵੇਂ ਸਿੱਖ ਰਹੇ ਹੋ?',
     'Tusi Punjabi kiven sikh rahe ho?',
     'How are you learning Punjabi?', true),
    (scenario_id, player_cast_id, 5,
     'ਮੈਂ ਇੱਕ ਐਪ ਨਾਲ ਸਿੱਖ ਰਿਹਾ ਹਾਂ',
     'Mai ik app naal sikh rihaa haa',
     'I''m learning with an app', false),
    (scenario_id, daadi_cast_id, 6,
     'ਵਾਹ! ਮੈਨੂੰ ਬਹੁਤ ਖ਼ੁਸ਼ੀ ਹੋਈ।',
     'Vaah! Mainu bahut khushi hoi.',
     'Wow! I''m very happy.', true),
    (scenario_id, daadi_cast_id, 7,
     'ਕੀ ਤੁਸੀਂ ਮੇਰੇ ਲਈ ਕੁਝ ਪੰਜਾਬੀ ਬੋਲ ਸਕਦੇ ਹੋ?',
     'Ki tusi mere lai kujh Punjabi bol sakde ho?',
     'Can you speak some Punjabi for me?', true),
    (scenario_id, player_cast_id, 8,
     'ਹਾਂ, ਥੋੜ੍ਹਾ ਬੋਲ ਸਕਦਾ ਹਾਂ',
     'Haa, thoda bol sakda haa',
     'Yes, I can speak a little', false),
    (scenario_id, daadi_cast_id, 9,
     'ਸ਼ਾਬਾਸ਼! ਤੁਸੀਂ ਬਹੁਤ ਵਧੀਆ ਬੋਲਦੇ ਹੋ।',
     'Shaabaash! Tusi bahut vadhia bolde ho.',
     'Well done! You speak very well.', true),
    (scenario_id, daadi_cast_id, 10,
     'ਅਗਲੀ ਵਾਰ ਜਦੋਂ ਤੁਸੀਂ ਆਓਗੇ, ਮੈਂ ਤੁਹਾਡੇ ਲਈ ਪਿੰਨੀਆਂ ਬਣਾਵਾਂਗੀ।',
     'Agli vaar jadoh tusi aaoge, mai tuhaade lai piniaa banaavaangi.',
     'Next time you visit, I''ll make pinni (sweets) for you.', true),
    (scenario_id, player_cast_id, 11,
     'ਮੈਨੂੰ ਬਹੁਤ ਉਡੀਕ ਹੈ',
     'Mainu bahut udeek hai',
     'I can''t wait', false),
    (scenario_id, daadi_cast_id, 12,
     'ਬਹੁਤ ਵਧੀਆ, ਪੁੱਤਰ! ਮੈਂ ਵੀ ਉਡੀਕਾਂਗੀ।',
     'Bahut vadhia, puttar! Mai vi udeekaangi.',
     'Wonderful, son! I''ll be waiting too.', true),
    (scenario_id, daadi_cast_id, 13,
     'ਆਪਣੇ ਮਾਤਾ-ਪਿਤਾ ਦਾ ਖ਼ਿਆਲ ਰੱਖਣਾ।',
     'Apne mata-pita da khiaal rakkhnaa.',
     'Take care of your parents.', true),
    (scenario_id, player_cast_id, 14,
     'ਮੈਂ ਖ਼ਿਆਲ ਰੱਖਾਂਗਾ',
     'Mai khiaal rakhaanga',
     'I will take care', false),
    (scenario_id, daadi_cast_id, 15,
     'ਸ਼ਾਬਾਸ਼, ਪੁੱਤਰ। ਰੱਬ ਤੁਹਾਡਾ ਭਲਾ ਕਰੇ।',
     'Shaabaash, puttar. Rabb tuhaadaa bhalaa kare.',
     'Well done, son. God bless you.', true),
    (scenario_id, daadi_cast_id, 16,
     'ਚੰਗਾ ਪੁੱਤਰ, ਹੁਣ ਫ਼ੋਨ ਰੱਖਦੇ ਹਾਂ। ਆਪਣਾ ਖ਼ਿਆਲ ਰੱਖਣਾ।',
     'Changa puttar, hun phone rakhde haa. Apnaa khiaal rakkhnaa.',
     'Okay son, let''s hang up now. Take care of yourself.', true),
    (scenario_id, player_cast_id, 17,
     'ਰੱਬ ਰਾਖਾ, ਮੈਂ ਤੁਹਾਨੂੰ ਪਿਆਰ ਕਰਦਾ ਹਾਂ',
     'Rabb raakhaa, mai tuhaanu piyaar karda haa',
     'Goodbye, I love you', false);

END $$;

NOTIFY pgrst, 'reload schema';
