export type Course = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  required_tier?: string | null;
};

export type Lesson = {
  id: string;
  course_id: string;
  lesson_number: number;
  title: string;
  audio_url: string | null;
  pdf_url: string | null;
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

export type FlashcardCategory = "alphabet" | "vocab" | "sentences";

export type FlashcardSet = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type SetCourseLink = {
  id: string;
  deck_id: string;
  course_id: string | null;
  lesson_id: string | null;
};

export type Flashcard = {
  id: string;
  deck_id: string | null;
  lesson_id: string | null;
  deck_name: string;
  front_text: string;
  back_text: string;
  category: FlashcardCategory | null;
  difficulty: number | null;
  topic_tags: string[];
  icon_name: string | null;
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

export type GenderedNoun = {
  id: string;
  punjabi_word: string;
  english_meaning: string;
  romanised: string | null;
  gender: "masculine" | "feminine";
  difficulty: number;
  topic_tags: string[];
  course_id: string | null;
  created_at: string;
};

export type GrammarSentence = {
  id: string;
  punjabi_sentence: string;
  english_translation: string;
  word_tiles: string[];
  difficulty: number;
  topic_tags: string[];
  course_id: string | null;
  created_at: string;
};

export type VerbConjugationRow = {
  id: string;
  verb_root: string;
  verb_meaning: string;
  conjugations: Record<string, unknown>;
  difficulty: number;
  course_id: string | null;
  created_at: string;
};

export type AdminEnrollment = {
  id: string;
  user_id: string;
  course_id: string;
  tutor_id: string;
  delivery_mode: string | null;
  cohort_id: string | null;
  studentLabel: string;
  studentEmail: string | null;
  tutorLabel: string;
  courseName: string;
  courseTier: string | null;
  cohortName: string | null;
};

export type AdminCohortMember = {
  userId: string;
  label: string;
  email: string | null;
};

export type AdminCohort = {
  id: string;
  name: string;
  course_id: string;
  courseName: string;
  tutor_id: string | null;
  tutorLabel: string | null;
  members: AdminCohortMember[];
};

export type AdminStaffMember = {
  userId: string;
  email: string | null;
  displayName: string;
  appRoles: string[];
};

export type AdminMemberListItem = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  accessTiers: string[];
};

export type AdminMemberDetail = {
  userId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  courseAccess: {
    foundational: boolean;
    beginners: boolean;
    community: boolean;
  };
  courseIds: {
    foundational: string | null;
    beginners: string | null;
    community: string | null;
  };
  foundationalEnrollment: {
    enrollmentId: string;
    tutorId: string;
    tutorLabel: string | null;
  } | null;
  beginnersEnrollment: {
    enrollmentId: string;
    tutorId: string;
    tutorLabel: string | null;
    deliveryMode: "one_to_one" | "group" | null;
    cohortId: string | null;
  } | null;
  activeCohorts: { cohortId: string; cohortName: string }[];
};

export type AdminData = {
  courses: Course[];
  lessons: Lesson[];
  quizzes: Quiz[];
  questions: QuizQuestion[];
  flashcardSets: FlashcardSet[];
  setCourseLinks: SetCourseLink[];
  flashcards: Flashcard[];
  teachers: Teacher[];
  events: Event[];
  grammarSentences: GrammarSentence[];
  verbConjugations: VerbConjugationRow[];
  genderedNouns: GenderedNoun[];
  enrollments: AdminEnrollment[];
  cohorts: AdminCohort[];
  staffMembers: AdminStaffMember[];
  errors?: {
    courses?: string;
    lessons?: string;
    quizzes?: string;
    questions?: string;
    flashcardSets?: string;
    setCourseLinks?: string;
    flashcards?: string;
    teachers?: string;
    events?: string;
    grammarSentences?: string;
    verbConjugations?: string;
    genderedNouns?: string;
    enrollments?: string;
    cohorts?: string;
    staffMembers?: string;
  };
};
