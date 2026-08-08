import Link from "next/link";
import { BookOpen, ClipboardList, Timer } from "lucide-react";
import type { EnglishExamCourseConfig } from "@/lib/learning/english-exam-courses";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";

type EnglishExamCourseHubProps = {
  courseId: string;
  courseName: string;
  config: EnglishExamCourseConfig;
  materialCount: number;
  questionCount: number;
};

export function EnglishExamCourseHub({
  courseId,
  courseName,
  config,
  materialCount,
  questionCount,
}: EnglishExamCourseHubProps) {
  const base = `/dashboard/english/learn/${courseId}`;
  const sections = [
    {
      href: `${base}/materials`,
      title: "Materials",
      description:
        materialCount > 0
          ? `${materialCount} chapter${materialCount === 1 ? "" : "s"} to read`
          : "Chapter explanations",
      icon: BookOpen,
    },
    {
      href: `${base}/practice`,
      title: "Practice bank",
      description:
        questionCount > 0
          ? `${questionCount} untimed practice questions`
          : "Practice at your own pace",
      icon: ClipboardList,
    },
    {
      href: `${base}/mock`,
      title: "Mock test",
      description: `${config.mockQuestionCount} questions · ${config.mockMinutes} min · pass ${config.passCorrect}/${config.mockQuestionCount}`,
      icon: Timer,
    },
  ] as const;

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">
        Prepare for the real exam with materials, untimed practice, and a timed mock.
      </p>
      <ul className="space-y-3">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                className={cn(
                  pressableClass,
                  "flex items-center gap-4 rounded-2xl border border-emerald-200 bg-white px-4 py-4 transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-zinc-900">
                    {section.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {section.description}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium text-emerald-700">
                  Open
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="pt-2 text-center text-xs text-zinc-400">{courseName}</p>
    </div>
  );
}
