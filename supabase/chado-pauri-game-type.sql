-- Add chado_pauri to game_scores.game_type check constraint
ALTER TABLE game_scores DROP CONSTRAINT IF EXISTS game_scores_game_type_check;

ALTER TABLE game_scores ADD CONSTRAINT game_scores_game_type_check
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
    'chado_pauri'
  ]));

NOTIFY pgrst, 'reload schema';
