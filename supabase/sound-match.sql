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
    'sound_match'
  ]));

NOTIFY pgrst, 'reload schema';
