-- =============================================================================
-- Level-up test question seed (starter bank — expand to ~30 per transition)
-- Run after learner-progression.sql
-- =============================================================================

DELETE FROM public.level_test_questions;

INSERT INTO public.level_test_questions (
  from_level, question_text, option_a, option_b, option_c, option_d, correct_answer, question_order
)
SELECT
  level_num,
  format('Placement/practice question %s for Level %s → %s transition', q_num, level_num, level_num + 1),
  format('Answer A (L%s-Q%s)', level_num, q_num),
  format('Answer B (L%s-Q%s)', level_num, q_num),
  format('Answer C (L%s-Q%s)', level_num, q_num),
  format('Answer D (L%s-Q%s)', level_num, q_num),
  (ARRAY['a', 'b', 'c', 'd'])[1 + ((level_num + q_num) % 4)],
  q_num
FROM generate_series(1, 7) AS level_num
CROSS JOIN generate_series(1, 30) AS q_num;

COMMENT ON TABLE public.level_test_questions IS
  'Starter seed uses placeholder MCQs — replace with course-verified content per transition.';
