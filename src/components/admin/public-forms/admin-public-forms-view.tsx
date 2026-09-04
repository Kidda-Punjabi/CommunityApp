"use client";

import { CopyButton } from "@/components/ui/copy-button";
import type {
  PublicFormCatalog,
  PublicFormCatalogFeedback,
  PublicFormCatalogQuiz,
} from "@/lib/admin/load-public-form-catalog";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";
import { useState } from "react";

type TabId = "quizzes" | "feedback";

export function AdminPublicFormsView({ catalog }: { catalog: PublicFormCatalog }) {
  const [tab, setTab] = useState<TabId>("quizzes");
  const [previewHref, setPreviewHref] = useState<string | null>(null);

  return (
    <div className={ui.page}>
      <Link href="/admin/content" className="text-sm font-medium text-violet-600 hover:text-violet-500">
        ← Admin home
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Public forms</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600">
          These are the unguessable links students get for backlog quizzes and lesson
          feedback. Open a student view to fill it in as they would, then check Notion
          (feedback) or <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">public_quiz_attempts</code>{" "}
          (quizzes).
        </p>
      </div>

      {catalog.error ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {catalog.error}
        </p>
      ) : null}

      {catalog.quizzes.length !== 14 || catalog.feedback.length !== 13 ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Expected 14 quizzes and 13 feedback links. Found {catalog.quizzes.length} quizzes
          and {catalog.feedback.length} feedback links.
        </p>
      ) : null}

      <div className="mt-6 flex gap-2">
        <TabButton
          active={tab === "quizzes"}
          onClick={() => setTab("quizzes")}
          label={`Quizzes (${catalog.quizzes.length})`}
        />
        <TabButton
          active={tab === "feedback"}
          onClick={() => setTab("feedback")}
          label={`Feedback (${catalog.feedback.length})`}
        />
      </div>

      {tab === "quizzes" ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-zinc-500">
            Scores save to the guest quiz table only — they do not write to Notion or
            logged-in <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">quiz_progress</code>.
          </p>
          {catalog.quizzes.map((quiz) => (
            <QuizRow
              key={quiz.slug}
              quiz={quiz}
              previewHref={previewHref}
              onTogglePreview={() =>
                setPreviewHref((current) => (current === quiz.href ? null : quiz.href))
              }
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-zinc-500">
            Includes Week 1 starting point, Week 1 session, Weeks 2–11, and Week 12
            end-of-course. Guest submits write Phone, Course, and Lesson into the Notion
            Feedback Database.
          </p>
          {catalog.feedback.map((form) => (
            <FeedbackRow
              key={form.slug}
              form={form}
              previewHref={previewHref}
              onTogglePreview={() =>
                setPreviewHref((current) => (current === form.href ? null : form.href))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-violet-600 text-white"
          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );
}

function QuizRow({
  quiz,
  previewHref,
  onTogglePreview,
}: {
  quiz: PublicFormCatalogQuiz;
  previewHref: string | null;
  onTogglePreview: () => void;
}) {
  const open = previewHref === quiz.href;
  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">{quiz.label}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
            {quiz.lessonNumber != null ? ` · linked lesson ${quiz.lessonNumber}` : ""}
            {quiz.questionCount === 0 ? " · will 404 for students until questions exist" : ""}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-400">/p/{quiz.slug}</p>
        </div>
        <RowActions href={quiz.href} open={open} onTogglePreview={onTogglePreview} />
      </div>
      {open ? <StudentPreview href={quiz.href} title={quiz.label} /> : null}
    </article>
  );
}

function FeedbackRow({
  form,
  previewHref,
  onTogglePreview,
}: {
  form: PublicFormCatalogFeedback;
  previewHref: string | null;
  onTogglePreview: () => void;
}) {
  const open = previewHref === form.href;
  const variantLabel =
    form.formVariant === "week1"
      ? "Starting point"
      : form.formVariant === "week12"
        ? "End of course"
        : "Session";

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900">{form.studentTitle}</h2>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              {variantLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Notion: {form.notionCourse} · {form.lessonLabel}
          </p>
          <p className="mt-1 text-sm text-zinc-600">{form.mappingNote}</p>
          <p className="mt-1 break-all font-mono text-xs text-zinc-400">/p/{form.slug}</p>
        </div>
        <RowActions href={form.href} open={open} onTogglePreview={onTogglePreview} />
      </div>
      {open ? <StudentPreview href={form.href} title={form.studentTitle} /> : null}
    </article>
  );
}

function RowActions({
  href,
  open,
  onTogglePreview,
}: {
  href: string;
  open: boolean;
  onTogglePreview: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onTogglePreview}
        className="inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {open ? "Hide preview" : "Preview"}
      </button>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
      >
        Open student view
      </a>
      <CopyButton text={href} variant="hub" className="px-3 py-2">
        Copy link
      </CopyButton>
    </div>
  );
}

function StudentPreview({ href, title }: { href: string; title: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
      <p className="border-b border-zinc-200 px-3 py-2 text-xs text-zinc-500">
        Student view preview — same page they open. Use Open student view to submit a real
        test.
      </p>
      <iframe
        src={href}
        title={`Student view: ${title}`}
        className="h-[720px] w-full bg-white"
      />
    </div>
  );
}
