import { TopicPracticeSession } from "@/components/learn/topic-practice-session";
import { BackLink } from "@/components/navigation/back-link";
import { buildTopicActivity } from "@/lib/free-lessons/build-activity";
import { loadCommunityTopicCards } from "@/lib/free-lessons/load-topic-cards";
import { fetchTopicMasteryMap } from "@/lib/free-lessons/mastery";
import { TOPIC_MASTERY_MAX_LEVEL } from "@/lib/free-lessons/topic-visuals";
import { COMMUNITY_COURSE_ID } from "@/lib/topics/constants";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PracticePageProps = {
  params: Promise<{ lessonId: string }>;
};

export default async function FreeLessonPracticePage({ params }: PracticePageProps) {
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

  if (
    !lesson ||
    lesson.course_id !== COMMUNITY_COURSE_ID ||
    !lesson.is_free
  ) {
    notFound();
  }

  const [masteryMap, topicCards] = await Promise.all([
    fetchTopicMasteryMap(supabase, user.id, [lessonId]),
    loadCommunityTopicCards(supabase, lesson.lesson_number),
  ]);

  const masteryLevel = masteryMap.get(lessonId)?.mastery_level ?? 0;

  if (masteryLevel >= TOPIC_MASTERY_MAX_LEVEL) {
    // Still allow practice — rebuild at hardest level (4).
    const activity = buildTopicActivity(topicCards.cards, 4);
    if (!activity) {
      return (
        <div className={ui.page}>
          <BackLink fallbackHref={`/dashboard/learn/free/${lessonId}`}>
            ← Back
          </BackLink>
          <p className="mt-8 text-sm text-zinc-500">
            Practice isn’t ready for this topic yet.
          </p>
        </div>
      );
    }

    return (
      <div className={ui.page}>
        <BackLink fallbackHref={`/dashboard/learn/free/${lessonId}`}>
          ← {lesson.title}
        </BackLink>
        <div className="mt-6">
          <TopicPracticeSession
            lessonId={lesson.id}
            topicTitle={lesson.title}
            activity={activity}
          />
        </div>
      </div>
    );
  }

  const activity = buildTopicActivity(topicCards.cards, masteryLevel);

  if (!activity) {
    return (
      <div className={ui.page}>
        <BackLink fallbackHref={`/dashboard/learn/free/${lessonId}`}>
          ← Back
        </BackLink>
        <div className="mt-8 space-y-3">
          <p className="text-sm text-zinc-500">
            Practice activities for this topic are coming soon.
          </p>
          <Link
            href={`/dashboard/learn/free/${lessonId}`}
            className="inline-flex text-sm font-semibold text-emerald-600 hover:text-emerald-500"
          >
            Back to topic
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <BackLink fallbackHref={`/dashboard/learn/free/${lessonId}`}>
        ← {lesson.title}
      </BackLink>
      <div className="mt-6">
        <TopicPracticeSession
          lessonId={lesson.id}
          topicTitle={lesson.title}
          activity={activity}
        />
      </div>
    </div>
  );
}
