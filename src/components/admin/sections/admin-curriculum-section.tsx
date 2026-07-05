"use client";

import { useState } from "react";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { CatchupSegmentsTab } from "@/app/admin/content/components/catchup-segments-tab";
import { CoursesLessonsTab } from "@/app/admin/content/components/courses-lessons-tab";
import { QuizzesTab } from "@/app/admin/content/components/quizzes-tab";
import { FlashcardsTab } from "@/app/admin/content/components/flashcards-tab";
import { AdminContentSubNav } from "@/components/admin/admin-content-sub-nav";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { AdminSectionTabs } from "@/components/admin/admin-section-tabs";
import { ui } from "@/lib/ui/styles";

const tabs = [
  { id: "lessons", label: "Courses & lessons" },
  { id: "catchup", label: "Catch-up segments" },
  { id: "quizzes", label: "Quizzes" },
  { id: "flashcards", label: "Flashcards" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminCurriculumSection() {
  const { data } = useAdminData();
  const [activeTab, setActiveTab] = useState<TabId>("lessons");

  return (
    <div className={ui.page}>
      <AdminContentSubNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Learn content</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Courses, lessons, quizzes, and flashcard decks.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />
      <AdminSectionTabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <div className="mt-6">
        {activeTab === "lessons" && <CoursesLessonsTab data={data} />}
        {activeTab === "catchup" && <CatchupSegmentsTab data={data} />}
        {activeTab === "quizzes" && <QuizzesTab data={data} />}
        {activeTab === "flashcards" && <FlashcardsTab data={data} />}
      </div>
    </div>
  );
}
