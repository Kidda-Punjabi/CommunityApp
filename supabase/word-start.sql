-- =============================================================================
-- Kidda — Word Start (solo vocab game)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.word_start_game_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_gurmukhi TEXT NOT NULL,
  meaning_english TEXT NOT NULL,
  romanised TEXT NOT NULL,
  starting_letter TEXT NOT NULL,
  distractor_letters TEXT[] NOT NULL,
  audio_pa_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT word_start_game_words_word_gurmukhi_unique UNIQUE (word_gurmukhi),
  CONSTRAINT word_start_game_words_distractors_len CHECK (
    cardinality(distractor_letters) BETWEEN 2 AND 3
  )
);

ALTER TABLE public.word_start_game_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read word_start_game_words" ON public.word_start_game_words;
CREATE POLICY "Authenticated read word_start_game_words"
  ON public.word_start_game_words FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage word_start_game_words" ON public.word_start_game_words;
CREATE POLICY "Admins manage word_start_game_words"
  ON public.word_start_game_words FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.word_start_game_words TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.word_start_game_words TO authenticated;
GRANT ALL ON public.word_start_game_words TO service_role;

INSERT INTO public.word_start_game_words (
  word_gurmukhi,
  meaning_english,
  romanised,
  starting_letter,
  distractor_letters,
  display_order
)
VALUES
  ('ਕਿਤਾਬ', 'book', 'kitaab', 'ਕ', ARRAY['ਖ', 'ਗ'], 1),
  ('ਕਲਮ', 'pen', 'kalam', 'ਕ', ARRAY['ਖ', 'ਚ'], 2),
  ('ਕੰਬਲ', 'blanket', 'kambal', 'ਕ', ARRAY['ਖ', 'ਪ'], 3),
  ('ਕੁੜੀ', 'girl', 'kuri', 'ਕ', ARRAY['ਖ', 'ਗ'], 4),
  ('ਘਰ', 'house', 'ghar', 'ਘ', ARRAY['ਗ', 'ਖ'], 5),
  ('ਗੱਡੀ', 'car', 'gaddi', 'ਗ', ARRAY['ਘ', 'ਕ'], 6),
  ('ਗਰਮ', 'hot', 'garam', 'ਗ', ARRAY['ਘ', 'ਕ'], 7),
  ('ਚਾਹ', 'tea', 'chaa', 'ਚ', ARRAY['ਛ', 'ਜ'], 8),
  ('ਚਾਵਲ', 'rice', 'chaval', 'ਚ', ARRAY['ਛ', 'ਜ'], 9),
  ('ਛੱਤ', 'ceiling', 'chath', 'ਛ', ARRAY['ਚ', 'ਝ'], 10),
  ('ਛੋਟਾ', 'short', 'chhota', 'ਛ', ARRAY['ਚ', 'ਝ'], 11),
  ('ਟਿਕਟ', 'ticket', 'tikat', 'ਟ', ARRAY['ਠ', 'ਤ'], 12),
  ('ਠੰਡਾ', 'cold', 'thanda', 'ਠ', ARRAY['ਟ', 'ਥ'], 13),
  ('ਤੌਲੀਆ', 'towel', 'toliaa', 'ਤ', ARRAY['ਥ', 'ਟ'], 14),
  ('ਥੈਲਾ', 'bag', 'thaila', 'ਥ', ARRAY['ਤ', 'ਠ'], 15),
  ('ਦੁੱਧ', 'milk', 'dudh', 'ਦ', ARRAY['ਧ', 'ਡ'], 16),
  ('ਦੰਦ', 'teeth', 'dand', 'ਦ', ARRAY['ਧ', 'ਡ'], 17),
  ('ਧੁੱਪ', 'sunshine', 'dhupp', 'ਧ', ARRAY['ਦ', 'ਢ'], 18),
  ('ਡਾਕਟਰ', 'doctor', 'daaktar', 'ਡ', ARRAY['ਢ', 'ਦ'], 19),
  ('ਪਾਣੀ', 'water', 'paani', 'ਪ', ARRAY['ਫ', 'ਬ'], 20),
  ('ਪਰਦਾ', 'curtain', 'pardaa', 'ਪ', ARRAY['ਫ', 'ਬ'], 21),
  ('ਫਲ', 'fruit', 'fal', 'ਫ', ARRAY['ਪ', 'ਭ'], 22),
  ('ਬਾਬਾ', 'grandfather', 'baba', 'ਬ', ARRAY['ਭ', 'ਪ'], 23),
  ('ਬੱਸ', 'bus', 'bass', 'ਬ', ARRAY['ਭ', 'ਪ'], 24),
  ('ਨਾਮ', 'name', 'naam', 'ਨ', ARRAY['ਣ', 'ਮ'], 25),
  ('ਨੱਕ', 'nose', 'nakk', 'ਨ', ARRAY['ਣ', 'ਮ'], 26),
  ('ਮਾਂ', 'mother', 'maa', 'ਮ', ARRAY['ਨ', 'ਬ'], 27),
  ('ਮੁੰਡਾ', 'boy', 'munda', 'ਮ', ARRAY['ਨ', 'ਪ'], 28),
  ('ਮੇਜ', 'table', 'mej', 'ਮ', ARRAY['ਨ', 'ਬ'], 29),
  ('ਜੁੱਤੇ', 'shoes', 'jutte', 'ਜ', ARRAY['ਝ', 'ਚ'], 30),
  ('ਖਾਣਾ', 'food', 'khaana', 'ਖ', ARRAY['ਕ', 'ਗ'], 31),
  ('ਖੇਡ', 'game', 'khed', 'ਖ', ARRAY['ਕ', 'ਘ'], 32),
  ('ਖਿੜਕੀ', 'window', 'khidki', 'ਖ', ARRAY['ਕ', 'ਗ'], 33),
  ('ਖੇਤ', 'field', 'khet', 'ਖ', ARRAY['ਕ', 'ਚ'], 34),
  ('ਚਾਬੀ', 'key', 'chaabi', 'ਚ', ARRAY['ਛ', 'ਜ'], 35),
  ('ਚੰਦ', 'moon', 'chand', 'ਚ', ARRAY['ਛ', 'ਕ'], 36),
  ('ਛਾਲ', 'jump', 'chhaal', 'ਛ', ARRAY['ਚ', 'ਝ'], 37),
  ('ਛਾਤੀ', 'chest', 'chhati', 'ਛ', ARRAY['ਚ', 'ਜ'], 38),
  ('ਟੋਪੀ', 'cap', 'topi', 'ਟ', ARRAY['ਠ', 'ਤ'], 39),
  ('ਟਮਾਟਰ', 'tomato', 'tamatar', 'ਟ', ARRAY['ਠ', 'ਤ'], 40),
  ('ਟੋਕਰੀ', 'basket', 'tokri', 'ਟ', ARRAY['ਠ', 'ਡ'], 41),
  ('ਠੀਕ', 'okay', 'theek', 'ਠ', ARRAY['ਟ', 'ਥ'], 42),
  ('ਠਾਣਾ', 'police station', 'thaana', 'ਠ', ARRAY['ਟ', 'ਤ'], 43),
  ('ਠੋਡੀ', 'chin', 'thodi', 'ਠ', ARRAY['ਟ', 'ਥ'], 44),
  ('ਤਾਰਾ', 'star', 'taara', 'ਤ', ARRAY['ਥ', 'ਟ'], 45),
  ('ਤੇਲ', 'oil', 'tel', 'ਤ', ARRAY['ਥ', 'ਦ'], 46),
  ('ਤਿੰਨ', 'three', 'tinn', 'ਤ', ARRAY['ਥ', 'ਟ'], 47),
  ('ਥਾਲ', 'platter', 'thaal', 'ਥ', ARRAY['ਤ', 'ਠ'], 48),
  ('ਥਾਂ', 'place', 'thaan', 'ਥ', ARRAY['ਤ', 'ਠ'], 49),
  ('ਥੱਪੜ', 'slap', 'thappar', 'ਥ', ARRAY['ਤ', 'ਠ'], 50),
  ('ਪਿਤਾ', 'father', 'pita', 'ਪ', ARRAY['ਫ', 'ਬ'], 51),
  ('ਪੱਤਾ', 'leaf', 'patta', 'ਪ', ARRAY['ਫ', 'ਬ'], 52),
  ('ਫੁੱਲ', 'flower', 'phull', 'ਫ', ARRAY['ਪ', 'ਭ'], 53),
  ('ਫੁੱਗਾ', 'balloon', 'phugga', 'ਫ', ARRAY['ਪ', 'ਬ'], 54),
  ('ਫੌਜ', 'army', 'fauj', 'ਫ', ARRAY['ਪ', 'ਭ'], 55),
  ('ਗਾਂ', 'cow', 'gaa', 'ਗ', ARRAY['ਘ', 'ਕ'], 56),
  ('ਗੀਤ', 'song', 'geet', 'ਗ', ARRAY['ਘ', 'ਕ'], 57),
  ('ਘੋੜਾ', 'horse', 'ghora', 'ਘ', ARRAY['ਗ', 'ਖ'], 58),
  ('ਘੜੀ', 'clock', 'ghadi', 'ਘ', ARRAY['ਗ', 'ਖ'], 59),
  ('ਘੱਟ', 'less', 'ghatt', 'ਘ', ARRAY['ਗ', 'ਕ'], 60),
  ('ਜੀਭ', 'tongue', 'jeebh', 'ਜ', ARRAY['ਝ', 'ਚ'], 61),
  ('ਜੰਗਲ', 'forest', 'jangal', 'ਜ', ARRAY['ਝ', 'ਗ'], 62),
  ('ਜਾਮ', 'cup', 'jaam', 'ਜ', ARRAY['ਝ', 'ਚ'], 63),
  ('ਝੰਡਾ', 'flag', 'jhanda', 'ਝ', ARRAY['ਜ', 'ਛ'], 64),
  ('ਝੂਲਾ', 'swing', 'jhoola', 'ਝ', ARRAY['ਜ', 'ਚ'], 65),
  ('ਝੀਲ', 'lake', 'jheel', 'ਝ', ARRAY['ਜ', 'ਛ'], 66),
  ('ਝੂਠ', 'lie', 'jhooth', 'ਝ', ARRAY['ਜ', 'ਚ'], 67),
  ('ਡੱਬਾ', 'box', 'dabba', 'ਡ', ARRAY['ਢ', 'ਦ'], 68),
  ('ਡਾਕ', 'post', 'daak', 'ਡ', ARRAY['ਢ', 'ਦ'], 69),
  ('ਡਰ', 'fear', 'dar', 'ਡ', ARRAY['ਢ', 'ਤ'], 70),
  ('ਢੋਲ', 'drum', 'dhol', 'ਢ', ARRAY['ਡ', 'ਧ'], 71),
  ('ਢੱਕਣ', 'lid', 'dhakkan', 'ਢ', ARRAY['ਡ', 'ਦ'], 72),
  ('ਢਾਲ', 'shield', 'dhaal', 'ਢ', ARRAY['ਡ', 'ਧ'], 73),
  ('ਢੇਰ', 'pile', 'dher', 'ਢ', ARRAY['ਡ', 'ਦ'], 74),
  ('ਦਾਦਾ', 'grandfather', 'daada', 'ਦ', ARRAY['ਧ', 'ਡ'], 75),
  ('ਦਿਲ', 'heart', 'dil', 'ਦ', ARRAY['ਧ', 'ਤ'], 76),
  ('ਧਰਤੀ', 'earth', 'dharti', 'ਧ', ARRAY['ਦ', 'ਢ'], 77),
  ('ਧਾਗਾ', 'thread', 'dhaaga', 'ਧ', ARRAY['ਦ', 'ਥ'], 78),
  ('ਧਨ', 'wealth', 'dhan', 'ਧ', ARRAY['ਦ', 'ਡ'], 79),
  ('ਬਿੱਲੀ', 'cat', 'billi', 'ਬ', ARRAY['ਭ', 'ਪ'], 80),
  ('ਬੱਚਾ', 'child', 'bacha', 'ਬ', ARRAY['ਭ', 'ਪ'], 81),
  ('ਭੈਣ', 'sister', 'bhain', 'ਭ', ARRAY['ਬ', 'ਪ'], 82),
  ('ਭਰਾ', 'brother', 'bhraa', 'ਭ', ARRAY['ਬ', 'ਫ'], 83),
  ('ਭੁੱਖ', 'hunger', 'bhukkh', 'ਭ', ARRAY['ਬ', 'ਪ'], 84),
  ('ਭਗਤ', 'devotee', 'bhagat', 'ਭ', ARRAY['ਬ', 'ਘ'], 85),
  ('ਨਦੀ', 'river', 'nadi', 'ਨ', ARRAY['ਣ', 'ਮ'], 86),
  ('ਨੀਂਦ', 'sleep', 'neend', 'ਨ', ARRAY['ਣ', 'ਮ'], 87),
  ('ਮੱਛੀ', 'fish', 'macchi', 'ਮ', ARRAY['ਨ', 'ਬ'], 88)
ON CONFLICT (word_gurmukhi) DO UPDATE SET
  meaning_english = EXCLUDED.meaning_english,
  romanised = EXCLUDED.romanised,
  starting_letter = EXCLUDED.starting_letter,
  distractor_letters = EXCLUDED.distractor_letters,
  display_order = EXCLUDED.display_order;

ALTER TABLE public.game_scores DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE public.game_scores ADD CONSTRAINT game_scores_game_type_check
  CHECK (game_type = ANY (ARRAY[
    'match',
    'memory_grid',
    'speed_translate',
    'word_scramble',
    'streak_survival',
    'sentence_builder',
    'conjugation_challenge',
    'gender_sort',
    'picture_match',
    'voice_practice',
    'chado_pauri',
    'conversation_practice',
    'possessive_practice',
    'spot_the_mistake',
    'comprehension_practice',
    'lane_runner',
    'speaking_practice',
    'vowel_match',
    'sound_match',
    'word_start'
  ]));

NOTIFY pgrst, 'reload schema';
