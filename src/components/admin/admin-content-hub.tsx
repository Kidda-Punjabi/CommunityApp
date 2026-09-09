"use client";

import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import { BookOpen, Globe } from "lucide-react";

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
      </AdminHubStack>
    </AdminHubPage>
  );
}
