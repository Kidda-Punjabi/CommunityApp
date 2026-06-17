"use client";

import { useState } from "react";
import type { AdminData } from "./types";
import { CoursesLessonsTab } from "./components/courses-lessons-tab";
import { QuizzesTab } from "./components/quizzes-tab";
import { FlashcardsTab } from "./components/flashcards-tab";
import { TeachersTab } from "./components/teachers-tab";

const tabs = [
  { id: "lessons", label: "Courses & Lessons" },
  { id: "quizzes", label: "Quizzes" },
  { id: "flashcards", label: "Flashcards" },
  { id: "teachers", label: "Teachers" },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function AdminContent({ data }: { data: AdminData }) {
  const [activeTab, setActiveTab] = useState<TabId>("lessons");

  return (
    <div>
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
        {activeTab === "teachers" && <TeachersTab data={data} />}
      </div>
    </div>
  );
}
