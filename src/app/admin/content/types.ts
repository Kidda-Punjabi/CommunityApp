export type Course = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
};

export type Lesson = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  audio_url: string | null;
  is_free: boolean;
  courses: { name: string } | null;
};

export type Quiz = {
  id: string;
  course_id: string;
  level_number: number;
  title: string;
  courses: { name: string } | null;
};

export type QuizQuestion = {
  id: string;
  quiz_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  question_order: number;
};

export type Flashcard = {
  id: string;
  deck_name: string;
  front_text: string;
  back_text: string;
};

export type Teacher = {
  id: string;
  name: string;
  bio: string | null;
  photo_url: string | null;
  specialty: string | null;
  contact_link: string | null;
  display_order: number;
};

export type AdminData = {
  courses: Course[];
  lessons: Lesson[];
  quizzes: Quiz[];
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  teachers: Teacher[];
};
