"use client";

import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import { BookOpen, Eye, Gift, Globe, HelpCircle, ScrollText, Sparkles } from "lucide-react";

export function AdminContentHub() {
  return (
    <AdminHubPage
      title="Content"
      description="Curriculum, games, and site communications."
    >
      <AdminHubStack>
        <AdminHubLinkCard
          href="/admin/content/curriculum"
          icon={<BookOpen className="h-[18px] w-[18px]" />}
          title="Learn content"
          summary="Courses, lessons, quizzes, and flashcards"
        />
        <AdminHubLinkCard
          href="/admin/content/site"
          icon={<Globe className="h-[18px] w-[18px]" />}
          title="Site and comms"
          summary="Events, announcements, branding, and recommendations"
        />
        <AdminHubLinkCard
          href="/admin/public-forms"
          icon={<ScrollText className="h-[18px] w-[18px]" />}
          title="Public forms"
          summary="Preview and test every backlog quiz and feedback link, including Week 1 starting point and Week 12"
        />
        <AdminHubLinkCard
          href="/admin/homework-test"
          icon={<Eye className="h-[18px] w-[18px]" />}
          title="Test homework submission"
          summary="See the live student homework page and submit as a cohort student"
        />
        <AdminHubLinkCard
          href="/admin/monthly-rewards"
          icon={<Gift className="h-[18px] w-[18px]" />}
          title="Monthly Rewards"
          summary="Calculate monthly top 3 and send Prezzee gift cards"
        />
        <AdminHubLinkCard
          href="/admin/content/kids-stories"
          icon={<Sparkles className="h-[18px] w-[18px]" />}
          title="Kids bedtime stories"
          summary="Author Premium kids stories (empty until content is approved)"
        />
        <AdminHubLinkCard
          href="/admin/content/help"
          icon={<HelpCircle className="h-[18px] w-[18px]" />}
          title="Help articles"
          summary="FAQs and SOPs for cohorts, members, curriculum, and payments"
        />
      </AdminHubStack>
    </AdminHubPage>
  );
}
