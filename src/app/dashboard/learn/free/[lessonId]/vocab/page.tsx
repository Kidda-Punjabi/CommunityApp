import { TopicVocabReview } from "@/components/learn/topic-vocab-review";
import { BackLink } from "@/components/navigation/back-link";
import { loadCommunityTopicCards } from "@/lib/free-lessons/load-topic-cards";
import { fetchTopicMasteryMap } from "@/lib/free-lessons/mastery";
import { resolveTopicUnlockState } from "@/lib/free-lessons/unlock";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { fetchFlashcardProgressMap } from "@/lib/progress/flashcard-progress";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type VocabPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function FreeLessonVocabPage({ params }: VocabPageProps) {
  const { lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, course_id, is_free")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || lesson.course_id !== COMMUNITY_COURSE_ID) notFound();

  const { data: previousLesson } =
    lesson.lesson_number > 1
      ? await supabase
          .from("lessons")
          .select("id")
          .eq("course_id", COMMUNITY_COURSE_ID)
          .eq("lesson_number", lesson.lesson_number - 1)
          .maybeSingle()
      : { data: null };

  const [hasPremium, masteryMap, topicCards] = await Promise.all([
    hasPremiumAccess(supabase, user.id),
    fetchTopicMasteryMap(
      supabase,
      user.id,
      [lessonId, previousLesson?.id].filter(Boolean) as string[]
    ),
    loadCommunityTopicCards(supabase, lesson.lesson_number),
  ]);

  const unlock = resolveTopicUnlockState({
    lessonNumber: lesson.lesson_number,
    isFree: Boolean(lesson.is_free),
    hasPremium,
    previousMasteryLevel: previousLesson
      ? masteryMap.get(previousLesson.id)?.mastery_level ?? 0
      : null,
  });

  if (!unlock.accessible) {
    if (unlock.lockReason === "premium") redirect(PREMIUM_UNLOCK_PATH);
    redirect(`/dashboard/learn/free/${lessonId}`);
  }

  const progressMap = await fetchFlashcardProgressMap(
    supabase,
    user.id,
    topicCards.cards.map((card) => card.id)
  );

  return (
    <div className={ui.page}>
      <BackLink href={`/dashboard/learn/free/${lessonId}`}>← {lesson.title}</BackLink>
      <div className="mt-6">
        <TopicVocabReview
          lessonId={lesson.id}
          topicTitle={lesson.title}
          cards={topicCards.cards}
          initiallyReviewedIds={[...progressMap.keys()]}
        />
      </div>
    </div>
  );
}
