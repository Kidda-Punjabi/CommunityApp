import { TopicGamePractice } from "@/components/learn/topic-game-practice";
import { BackLink } from "@/components/navigation/back-link";
import { resolveTopicGameActivity } from "@/lib/free-lessons/activity-games";
import { loadCommunityTopicCards } from "@/lib/free-lessons/load-topic-cards";
import { fetchTopicMasteryMap } from "@/lib/free-lessons/mastery";
import { resolveTopicUnlockState } from "@/lib/free-lessons/unlock";
import { STAGE_DEPTH_MAX, type TopicStageId } from "@/lib/free-lessons/stages";
import { hasPremiumAccess } from "@/lib/membership/premium-access";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PracticePageProps = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ stage?: string; n?: string; retry?: string }>;
};

export default async function FreeLessonPracticePage({
  params,
  searchParams,
}: PracticePageProps) {
  const { lessonId } = await params;
  const { stage: stageParam, n: nextParam, retry: retryParam } = await searchParams;
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

  const mastery = masteryMap.get(lessonId);
  let stage: TopicStageId = mastery?.stage ?? 1;
  let depth = mastery?.depth ?? 0;

  const requested = Number(stageParam);
  if (requested >= 1 && requested <= 3 && requested <= stage) {
    stage = requested as TopicStageId;
    depth =
      requested === (mastery?.stage ?? 1)
        ? Math.min(depth, STAGE_DEPTH_MAX - 1)
        : STAGE_DEPTH_MAX - 1;
  } else if (depth >= STAGE_DEPTH_MAX && stage < 3) {
    stage = (stage + 1) as TopicStageId;
    depth = 0;
  } else if (depth >= STAGE_DEPTH_MAX) {
    depth = STAGE_DEPTH_MAX - 1;
  }

  const spec = resolveTopicGameActivity(stage, depth);

  return (
    <div className={ui.page}>
      <BackLink href={`/dashboard/learn/free/${lessonId}`}>← {lesson.title}</BackLink>
      <div className="mt-6">
        {spec && topicCards.cards.length >= 2 ? (
          <TopicGamePractice
            key={`${nextParam ?? "start"}-${retryParam ?? "0"}-${stage}-${depth}`}
            lessonId={lesson.id}
            topicTitle={lesson.title}
            cards={topicCards.cards}
            spec={spec}
          />
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-zinc-500">
              Practice activities for this topic are coming soon.
            </p>
            <Link
              href={`/dashboard/learn/free/${lessonId}`}
              className="inline-flex text-sm font-semibold text-violet-600 hover:text-violet-500"
            >
              Back to topic
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
