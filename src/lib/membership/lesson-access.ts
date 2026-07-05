import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { canAccessLessonInContext } from "@/lib/learning/learn-access";
import { getCourseRequiredTier } from "./access";
import { getCourseAccessContext } from "./unlocked";
import { isQuizLevelUnlocked } from "@/lib/progress/quiz-progress";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function canUserAccessLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select(
      "id, course_id, lesson_number, title, is_free, courses(id, name, required_tier)"
    )
    .eq("id", lessonId)
    .single();

  if (!lesson) return { allowed: false as const, lesson: null, requiredCourseLabel: null };

  const course = Array.isArray(lesson.courses) ? lesson.courses[0] : lesson.courses;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user
    ? await getCourseAccessContext(supabase, user)
    : {
        unlockedCourseIds: new Set<string>(),
        courses: [],
        isFreeOnly: true,
        viewAs: null,
      };

  return {
    allowed: canAccessLessonInContext(access, lesson),
    lesson,
    requiredCourseLabel: course?.name ?? null,
    requiredTier: course ? getCourseRequiredTier(course) : null,
  };
}

async function checkQuizMembershipAccess(
  supabase: SupabaseClient,
  userId: string,
  quiz: { course_id: string; level_number: number }
) {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, course_id, lesson_number, title, is_free, courses(id, name, required_tier)")
    .eq("course_id", quiz.course_id)
    .eq("lesson_number", quiz.level_number)
    .maybeSingle();

  if (lesson) {
    return canUserAccessLesson(supabase, userId, lesson.id);
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, name, required_tier")
    .eq("id", quiz.course_id)
    .single();

  if (!course) {
    return {
      allowed: false as const,
      lesson: null,
      requiredCourseLabel: null,
      requiredTier: null,
      levelLocked: false,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = user
    ? await getCourseAccessContext(supabase, user)
    : {
        unlockedCourseIds: new Set<string>(),
        courses: [],
        isFreeOnly: true,
        viewAs: null,
      };

  return {
    allowed: canAccessLessonInContext(access, {
      is_free: false,
      course_id: quiz.course_id,
    }),
    lesson: null,
    requiredCourseLabel: course.name,
    requiredTier: getCourseRequiredTier(course),
    levelLocked: false,
  };
}

export async function canUserAccessQuiz(
  supabase: SupabaseClient,
  userId: string,
  quizId: string
) {
  const { data: quiz } = await supabase
    .from("quizzes")
    .select("id, course_id, level_number, title")
    .eq("id", quizId)
    .single();

  if (!quiz) {
    return {
      allowed: false as const,
      lesson: null,
      requiredCourseLabel: null,
      requiredTier: null,
      levelLocked: false,
      previousLevel: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (await canAccessAdminPanel(user, supabase))) {
    const membership = await checkQuizMembershipAccess(supabase, userId, quiz);
    return {
      allowed: true as const,
      lesson: membership.lesson,
      requiredCourseLabel: membership.requiredCourseLabel,
      requiredTier: membership.requiredTier,
      levelLocked: false,
      previousLevel: null,
    };
  }

  const membership = await checkQuizMembershipAccess(supabase, userId, quiz);

  if (!membership.allowed) {
    return {
      ...membership,
      levelLocked: false,
      previousLevel: null,
    };
  }

  const levelUnlocked = await isQuizLevelUnlocked(
    supabase,
    userId,
    quiz.course_id,
    quiz.level_number
  );

  if (!levelUnlocked) {
    const { data: previousQuiz } = await supabase
      .from("quizzes")
      .select("id, level_number, title")
      .eq("course_id", quiz.course_id)
      .eq("level_number", quiz.level_number - 1)
      .maybeSingle();

    return {
      allowed: false as const,
      lesson: membership.lesson,
      requiredCourseLabel: membership.requiredCourseLabel,
      requiredTier: membership.requiredTier,
      levelLocked: true,
      previousLevel: previousQuiz?.level_number ?? quiz.level_number - 1,
    };
  }

  return {
    ...membership,
    levelLocked: false,
    previousLevel: null,
  };
}
