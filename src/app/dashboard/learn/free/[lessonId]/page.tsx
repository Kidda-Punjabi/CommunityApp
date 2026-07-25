import { TopicHubCard } from "@/components/learn/topic-hub-card";
import { BackLink } from "@/components/navigation/back-link";
import { activityMetaForLevel } from "@/lib/free-lessons/activity-meta";
import { loadCommunityTopicCards } from "@/lib/free-lessons/load-topic-cards";
import {
  fetchTopicMasteryMap,
  stageFillsForMastery,
} from "@/lib/free-lessons/mastery";
import { resolveTopicUnlockState } from "@/lib/free-lessons/unlock";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { notFound, redirect } from "next/navigation";

type TopicPageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function FreeLessonTopicPage({ params }: TopicPageProps) {
  const { lessonId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, lesson_number, presentation_url, course_id, is_free")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson || lesson.course_id !== COMMUNITY_COURSE_ID) {
    notFound();
  }

  const { data: previousLesson } =
    lesson.lesson_number > 1
      ? await supabase
          .from("lessons")
          .select("id")
          .eq("course_id", COMMUNITY_COURSE_ID)
          .eq("lesson_number", lesson.lesson_number - 1)
          .maybeSingle()
      : { data: null };

  const lessonIds = [lessonId, previousLesson?.id].filter(Boolean) as string[];

  const [hasPremium, masteryMap, topicCards] = await Promise.all([
    hasPremiumAccess(supabase, user.id),
    fetchTopicMasteryMap(supabase, user.id, lessonIds),
    loadCommunityTopicCards(supabase, lesson.lesson_number),
  ]);

  const previousMastery = previousLesson
    ? masteryMap.get(previousLesson.id)?.mastery_level ?? 0
    : null;
  const unlock = resolveTopicUnlockState({
    lessonNumber: lesson.lesson_number,
    isFree: Boolean(lesson.is_free),
    hasPremium,
    previousMasteryLevel: previousMastery,
  });

  const mastery = masteryMap.get(lessonId);
  const stage = mastery?.stage ?? 1;
  const depth = mastery?.depth ?? 0;
  const activityTitle = activityMetaForLevel(stage, depth)?.title ?? null;
  const sentenceReady = topicCards.cards.some(
    (card) => card.back_text.trim().split(/\s+/).filter(Boolean).length >= 2
  );

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn/free">← Everyday Punjabi</BackLink>
      <div className="mt-8">
        <TopicHubCard
          lessonId={lesson.id}
          title={lesson.title}
          sortIndex={lesson.lesson_number - 1}
          stage={stage}
          depth={depth}
          fills={stageFillsForMastery(mastery)}
          hasPractice={topicCards.cards.length >= 2}
          activityTitle={activityTitle}
          vocabTotal={topicCards.cards.length}
          sentenceReady={sentenceReady}
          accessible={unlock.accessible}
          lockReason={unlock.lockReason}
        />
      </div>
    </div>
  );
}
