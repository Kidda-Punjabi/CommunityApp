export type PublicQuizView = {
  quizId: string;
  quizTitle: string;
  courseName: string;
  lessonNumber: number | null;
  questions: Array<{
    id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: string;
    question_order: number;
    question_audio_pa_url?: string | null;
  }>;
};
