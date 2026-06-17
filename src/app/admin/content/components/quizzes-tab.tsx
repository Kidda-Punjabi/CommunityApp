"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkCreateQuizQuestions,
  createQuiz,
  createQuizQuestion,
  deleteQuiz,
  deleteQuizQuestion,
  updateQuizQuestion,
  type ActionResult,
} from "../actions";
import type { AdminData } from "../types";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initialState: ActionResult = {};

export function QuizzesTab({ data }: { data: AdminData }) {
  const [quizState, quizAction, quizPending] = useActionState(
    createQuiz,
    initialState
  );
  const [questionState, questionAction, questionPending] = useActionState(
    createQuizQuestion,
    initialState
  );
  const [bulkState, bulkAction, bulkPending] = useActionState(
    bulkCreateQuizQuestions,
    initialState
  );
  const [bulkText, setBulkText] = useState("");
  const [bulkQuizId, setBulkQuizId] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const bulkPreview = useMemo(() => parseBulkQuestions(bulkText), [bulkText]);

  return (
    <div className="space-y-6">
      {data.courses.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No courses are loaded. Add rows in the `courses` table first, or check the
          fetch error banner above.
        </p>
      )}
      <SectionCard title="Add quiz">
        <form action={quizAction} className="space-y-4">
          <div>
            <label className={labelClass}>Link to lesson (recommended)</label>
            <select name="lesson_id" className={inputClass}>
              <option value="">No specific lesson</option>
              {data.lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.courses?.name} · Lesson {lesson.lesson_number}: {lesson.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Course</label>
              <select name="course_id" required className={inputClass}>
                <option value="">Select course</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Level number</label>
              <input
                name="level_number"
                type="number"
                min={1}
                required
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input name="title" required className={inputClass} />
          </div>
          <FormMessage state={quizState} />
          <button type="submit" disabled={quizPending} className={buttonClass}>
            {quizPending ? "Saving…" : "Add quiz"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Add question to quiz">
        <form action={questionAction} className="space-y-4">
          <div>
            <label className={labelClass}>Quiz</label>
            <select name="quiz_id" required className={inputClass}>
              <option value="">Select quiz</option>
              {data.quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.courses?.name} · Level {q.level_number}: {q.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Question</label>
            <textarea
              name="question_text"
              required
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="option_a" placeholder="Option A" required className={inputClass} />
            <input name="option_b" placeholder="Option B" required className={inputClass} />
            <input name="option_c" placeholder="Option C" required className={inputClass} />
            <input name="option_d" placeholder="Option D" required className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Correct answer</label>
              <select name="correct_answer" required className={inputClass}>
                <option value="a">A</option>
                <option value="b">B</option>
                <option value="c">C</option>
                <option value="d">D</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Question order</label>
              <input
                name="question_order"
                type="number"
                min={0}
                defaultValue={0}
                className={inputClass}
              />
            </div>
          </div>
          <FormMessage state={questionState} />
          <button
            type="submit"
            disabled={questionPending}
            className={buttonClass}
          >
            {questionPending ? "Saving…" : "Add question"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Bulk import questions">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Quiz</label>
            <select
              value={bulkQuizId}
              onChange={(event) => setBulkQuizId(event.target.value)}
              className={inputClass}
            >
              <option value="">Select quiz</option>
              {data.quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.courses?.name} · Level {q.level_number}: {q.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Paste questions</label>
            <textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              rows={12}
              className={inputClass}
              placeholder={
                "Q: What does 'Sat Sri Akal' mean?\n\nA: Hello\nB: Goodbye\nC: Thank you\nD: Please\nCorrect: A"
              }
            />
          </div>

          {bulkPreview.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <p className="font-medium">Parse warnings:</p>
              <ul className="mt-1 list-disc pl-5">
                {bulkPreview.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {bulkPreview.items.length > 0 && (
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-sm font-semibold text-zinc-700">
                Preview ({bulkPreview.items.length} question
                {bulkPreview.items.length === 1 ? "" : "s"})
              </p>
              <ul className="space-y-2 text-sm">
                {bulkPreview.items.map((item, index) => (
                  <li key={`${item.question_text}-${index}`} className="rounded bg-zinc-50 p-2">
                    <p className="font-medium text-zinc-900">
                      {index + 1}. {item.question_text}
                    </p>
                    <p className="mt-1 text-zinc-600">
                      A: {item.option_a} · B: {item.option_b} · C: {item.option_c} · D:{" "}
                      {item.option_d} · Correct: {item.correct_answer.toUpperCase()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form action={bulkAction}>
            <input type="hidden" name="quiz_id" value={bulkQuizId} />
            <input
              type="hidden"
              name="bulk_items"
              value={JSON.stringify(
                bulkPreview.items.map((item, index) => ({
                  ...item,
                  question_order: index + 1,
                }))
              )}
            />
            <FormMessage state={bulkState} />
            <button
              type="submit"
              disabled={bulkPending || !bulkQuizId || bulkPreview.items.length === 0}
              className={buttonClass}
            >
              {bulkPending ? "Importing…" : "Import questions"}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard title={`Quizzes (${data.quizzes.length})`}>
        {data.quizzes.length === 0 ? (
          <p className="text-sm text-zinc-500">No quizzes yet.</p>
        ) : (
          <ul className="space-y-6">
            {data.quizzes.map((quiz) => {
              const quizQuestions = data.questions.filter(
                (q) => q.quiz_id === quiz.id
              );
              return (
                <li
                  key={quiz.id}
                  className="rounded-lg border border-zinc-100 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900">
                        {quiz.courses?.name} · Level {quiz.level_number}:{" "}
                        {quiz.title}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {quizQuestions.length} question
                        {quizQuestions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <DeleteQuizButton id={quiz.id} />
                  </div>
                  {quizQuestions.length > 0 && (
                    <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
                      {quizQuestions.map((q) =>
                        editingQuestionId === q.id ? (
                          <QuizQuestionEditRow
                            key={q.id}
                            question={q}
                            onCancel={() => setEditingQuestionId(null)}
                            onSaved={() => setEditingQuestionId(null)}
                          />
                        ) : (
                          <li
                            key={q.id}
                            className="flex items-start justify-between gap-3 text-sm"
                          >
                            <div>
                              <p className="font-medium text-zinc-800">
                                {q.question_order}. {q.question_text}
                              </p>
                              <p className="mt-1 text-zinc-500">
                                A: {q.option_a} · B: {q.option_b} · C: {q.option_c} · D:{" "}
                                {q.option_d} · Correct: {q.correct_answer.toUpperCase()}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingQuestionId(q.id)}
                                className={secondaryButtonClass}
                              >
                                Edit
                              </button>
                              <DeleteQuestionButton id={q.id} />
                            </div>
                          </li>
                        )
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function QuizQuestionEditRow({
  question,
  onCancel,
  onSaved,
}: {
  question: AdminData["questions"][0];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateQuizQuestion, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <li className="rounded bg-zinc-50 p-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="id" value={question.id} />
        <textarea
          name="question_text"
          defaultValue={question.question_text}
          rows={2}
          className={inputClass}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="option_a" defaultValue={question.option_a} className={inputClass} required />
          <input name="option_b" defaultValue={question.option_b} className={inputClass} required />
          <input name="option_c" defaultValue={question.option_c} className={inputClass} required />
          <input name="option_d" defaultValue={question.option_d} className={inputClass} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            name="correct_answer"
            defaultValue={question.correct_answer}
            className={inputClass}
            required
          >
            <option value="a">A</option>
            <option value="b">B</option>
            <option value="c">C</option>
            <option value="d">D</option>
          </select>
          <input
            name="question_order"
            type="number"
            defaultValue={question.question_order}
            className={inputClass}
            min={0}
          />
        </div>
        <FormMessage state={state} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            Save
          </button>
          <button type="button" onClick={onCancel} className={secondaryButtonClass}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function DeleteQuizButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this quiz and all its questions?")) return;
        setPending(true);
        await deleteQuiz(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}

function DeleteQuestionButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this question?")) return;
        setPending(true);
        await deleteQuizQuestion(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}

function parseBulkQuestions(raw: string) {
  const items: Array<{
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: "a" | "b" | "c" | "d";
  }> = [];
  const errors: string[] = [];

  const lines = raw.split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^Q:/i.test(trimmed) && current.length > 0) {
      blocks.push(current);
      current = [trimmed];
      continue;
    }
    current.push(trimmed);
  }
  if (current.length > 0) blocks.push(current);

  blocks.forEach((block, index) => {
    const getValue = (prefix: string) =>
      block.find((line) => new RegExp(`^${prefix}:`, "i").test(line))
        ?.replace(new RegExp(`^${prefix}:\\s*`, "i"), "")
        .trim();

    const question = getValue("Q");
    const optionA = getValue("A");
    const optionB = getValue("B");
    const optionC = getValue("C");
    const optionD = getValue("D");
    const correctRaw = getValue("Correct")?.toLowerCase();

    if (
      !question ||
      !optionA ||
      !optionB ||
      !optionC ||
      !optionD ||
      !correctRaw ||
      !["a", "b", "c", "d"].includes(correctRaw)
    ) {
      errors.push(`Question block ${index + 1} is incomplete and was skipped.`);
      return;
    }

    items.push({
      question_text: question,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_answer: correctRaw as "a" | "b" | "c" | "d",
    });
  });

  return { items, errors };
}
