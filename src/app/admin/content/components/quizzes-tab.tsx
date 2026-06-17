"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createQuiz,
  createQuizQuestion,
  deleteQuiz,
  deleteQuizQuestion,
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

  return (
    <div className="space-y-6">
      <SectionCard title="Add quiz">
        <form action={quizAction} className="space-y-4">
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
                      {quizQuestions.map((q) => (
                        <li
                          key={q.id}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <div>
                            <p className="font-medium text-zinc-800">
                              {q.question_order}. {q.question_text}
                            </p>
                            <p className="mt-1 text-zinc-500">
                              A: {q.option_a} · B: {q.option_b} · C:{" "}
                              {q.option_c} · D: {q.option_d} · Correct:{" "}
                              {q.correct_answer.toUpperCase()}
                            </p>
                          </div>
                          <DeleteQuestionButton id={q.id} />
                        </li>
                      ))}
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
