"use client";

import { useState } from "react";
import type { AdminData } from "./types";
import { CoursesLessonsTab } from "./components/courses-lessons-tab";
import { QuizzesTab } from "./components/quizzes-tab";
import { FlashcardsTab } from "./components/flashcards-tab";
import { EventsTab } from "./components/events-tab";
import { TeachersTab } from "./components/teachers-tab";
import { StreakDebugTab } from "./components/streak-debug-tab";
import { SentenceBuilderTab } from "./components/sentence-builder-tab";
import { ConjugationTab } from "./components/conjugation-tab";
import { GenderSortTab } from "./components/gender-sort-tab";
import { StaffTutorsTab } from "./components/staff-tutors-tab";
import { MembersTab } from "./components/members-tab";
import { AnnouncementsTab } from "./components/announcements-tab";
import { BrandingTab } from "./components/branding-tab";
import type { SiteBranding } from "@/lib/branding/types";

const tabs = [
  { id: "lessons", label: "Courses & Lessons" },
  { id: "quizzes", label: "Quizzes" },
  { id: "flashcards", label: "Flashcards" },
  { id: "sentence-builder", label: "Sentence builder" },
  { id: "conjugation", label: "Conjugation" },
  { id: "gender-sort", label: "Gender sort" },
  { id: "events", label: "Events" },
  { id: "teachers", label: "Teachers" },
  { id: "members", label: "Members" },
  { id: "staff", label: "Staff & tutors" },
  { id: "announcements", label: "Announcements" },
  { id: "branding", label: "Branding" },
  { id: "streaks", label: "Streak debug" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminContent({
  data,
  branding,
}: {
  data: AdminData;
  branding: SiteBranding;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("lessons");
  const fetchErrors = Object.entries(data.errors ?? {}).filter(([, value]) => value);

  return (
    <div>
      {fetchErrors.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Some admin data failed to load:</p>
          <ul className="mt-1 list-disc pl-5">
            {fetchErrors.map(([key, value]) => (
              <li key={key}>
                {key}: {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-violet-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "lessons" && <CoursesLessonsTab data={data} />}
        {activeTab === "quizzes" && <QuizzesTab data={data} />}
        {activeTab === "flashcards" && <FlashcardsTab data={data} />}
        {activeTab === "sentence-builder" && <SentenceBuilderTab data={data} />}
        {activeTab === "conjugation" && <ConjugationTab data={data} />}
        {activeTab === "gender-sort" && <GenderSortTab data={data} />}
        {activeTab === "events" && <EventsTab data={data} />}
        {activeTab === "teachers" && <TeachersTab data={data} />}
        {activeTab === "members" && <MembersTab data={data} />}
        {activeTab === "staff" && <StaffTutorsTab data={data} />}
        {activeTab === "announcements" && <AnnouncementsTab />}
        {activeTab === "branding" && <BrandingTab initialBranding={branding} />}
        {activeTab === "streaks" && <StreakDebugTab />}
      </div>
    </div>
  );
}
