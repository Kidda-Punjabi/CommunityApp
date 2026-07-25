import { TopicHubCard } from "@/components/learn/topic-hub-card";
import { BackLink } from "@/components/navigation/back-link";
import { activityMetaForLevel } from "@/lib/free-lessons/activity-meta";
import { loadCommunityTopicCards } from "@/lib/free-lessons/load-topic-cards";
import { fetchTopicMasteryMap, ringProgressPercent } from "@/lib/free-lessons/mastery";
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

  const mastery = masteryMap.get(lessonId);
  const masteryLevel = mastery?.mastery_level ?? 0;
  const activityTitle = activityMetaForLevel(masteryLevel)?.title ?? null;

  return (
    <div className={ui.page}>
      <BackLink fallbackHref="/dashboard/learn/free">← Free Lessons</BackLink>
      <div className="mt-8">
        <TopicHubCard
          lessonId={lesson.id}
          title={lesson.title}
          sortIndex={lesson.lesson_number - 1}
          masteryLevel={masteryLevel}
          ringPercent={ringProgressPercent(mastery)}
          presentationUrl={lesson.presentation_url}
          hasPractice={topicCards.cards.length >= 2}
          activityTitle={activityTitle}
        />
      </div>
    </div>
  );
}
