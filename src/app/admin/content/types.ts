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
  lesson_id: string | null;
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
  lesson_id: string | null;
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

export type Event = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  meeting_url: string | null;
  external_url: string | null;
  required_tier: string | null;
  is_free: boolean;
  display_order: number;
  recurrence_freq: string | null;
  recurrence_until: string | null;
};

export type AdminData = {
  courses: Course[];
  lessons: Lesson[];
  quizzes: Quiz[];
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  teachers: Teacher[];
  events: Event[];
  errors?: {
    courses?: string;
    lessons?: string;
    quizzes?: string;
    questions?: string;
    flashcards?: string;
    teachers?: string;
    events?: string;
  };
};
