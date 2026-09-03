"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Volume2 } from "lucide-react";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { useAudioManager } from "@/lib/audio/audio-manager";
import {
  applySpeechPlaybackRate,
  NORMAL_SPEECH_RATE,
  SLOW_SPEECH_RATE,
} from "@/lib/audio/speech-playback";
import { CatchupReturnButton } from "@/components/catchup/catchup-return-button";
import { LessonFeedbackPanel } from "@/components/feedback/lesson-feedback-panel";
import { PointsEarnedBadge } from "@/components/points/points-earned-badge";
import { createClient } from "@/lib/supabase/client";
import { gurmukhiOptionName } from "@/lib/learn/gurmukhi-letter-names";
import { sumPointsEarned } from "@/lib/points/notify-points-earned";
import { quizScorePercent, saveQuizProgress } from "@/lib/progress/quiz-progress";
import { PASSING_QUIZ_SCORE } from "@/lib/progress/quiz-progress";
import {
  learningProductForLesson,
  learningProductForQuiz,
} from "@/lib/learning/learning-product";
import { recordStreakActivity, type StreakResult } from "@/lib/progress/streak";
import { SessionProgressBar } from "@/components/session-progress-bar";

export type QuizQuestion = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  question_order: number;
  question_audio_pa_url?: string | null;
};

type QuizPlayerProps = {
  quizId: string;
  quizTitle: string;
  courseName: string;
  lessonNumber: number | null;
  lessonId?: string | null;
  questions: QuizQuestion[];
  catchupReturn?: string | null;
};

export function QuizPlayer({
  quizId,
  quizTitle,
  courseName,
  lessonNumber,
  lessonId,
  questions,
  catchupReturn,
}: QuizPlayerProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [streakResult, setStreakResult] = useState<StreakResult | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [lessonCompleted, setLessonCompleted] = useState(false);
  const [heardQuestionId, setHeardQuestionId] = useState<string | null>(null);
  const savedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { playSound } = useAudioManager();

  const question = questions[index];
  const audioUrl = question.question_audio_pa_url?.trim() || null;
  const heardAudio = !audioUrl || heardQuestionId === question.id;
  const isCorrect = selected === question.correct_answer;
  const showNextButton = Boolean(selected && !isCorrect);
  const answersLocked = Boolean(audioUrl && !heardAudio && !selected);
  const options = [
    { key: "a", label: question.option_a },
    { key: "b", label: question.option_b },
    { key: "c", label: question.option_c },
    { key: "d", label: question.option_d },
  ];

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [question.id]);

  function playQuestionAudio(rate: number) {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    applySpeechPlaybackRate(audio, rate);
    audio.currentTime = 0;
    void audio
      .play()
      .then(() => setHeardQuestionId(question.id))
      .catch(() => {
        // Autoplay can fail until the student taps Listen.
      });
  }

  useEffect(() => {
    if (!finished || savedRef.current) return;

    savedRef.current = true;

    const persist = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const percentage = quizScorePercent(score, questions.length);
      const result = await saveQuizProgress(supabase, user.id, quizId, percentage, { lessonId });
      const totalPoints = sumPointsEarned([result.quizPoints, result.lessonBonus]);
      setPointsEarned(totalPoints);
      if (result.lessonBonus > 0) {
        setLessonCompleted(true);
      }

      if (percentage >= PASSING_QUIZ_SCORE) {
        const product = lessonId
          ? await learningProductForLesson(supabase, lessonId)
          : await learningProductForQuiz(supabase, quizId);
        if (product === "punjabi") {
          const result = await recordStreakActivity(supabase, user.id);
          setStreakResult(result);
        }
      }
    };

    void persist().catch((error) => {
      console.error("Failed to save quiz progress:", error);
      savedRef.current = false;
    });
  }, [finished, quizId, lessonId, score, questions.length]);

  function advanceQuestion() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSelected(null);
  }

  useEffect(() => {
    if (!selected || selected !== question.correct_answer) return;

    const timeout = window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        setFinished(true);
      } else {
        setIndex((prev) => prev + 1);
        setSelected(null);
      }
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [selected, question.correct_answer, index, questions.length]);

  useEffect(() => {
    if (!selected) return;
    playSound(selected === question.correct_answer ? "correct" : "incorrect");
  }, [selected, question.correct_answer, playSound]);

  useEffect(() => {
    if (!finished) return;
    playSound("game_complete");
  }, [finished, playSound]);

  function handleSelect(optionKey: string) {
    if (selected || answersLocked) return;
    setSelected(optionKey);
    if (optionKey === question.correct_answer) {
      setScore((prev) => prev + 1);
    }
  }

  function handleNext() {
    advanceQuestion();
  }

  if (finished) {
    return (
      <div className="relative rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <FloatingSoundToggle />
        <p className="text-sm font-medium text-violet-600">Quiz complete</p>
        <h2 className="mt-2 text-2xl font-bold text-zinc-900">
          {score} / {questions.length} correct
        </h2>
        <PointsEarnedBadge points={pointsEarned} className="mt-3" />
        {streakResult?.streak_rescued && (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
            Streak rescued! Back to {streakResult.display_streak} day
            {streakResult.display_streak === 1 ? "" : "s"}.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          <CatchupReturnButton returnUrl={catchupReturn} />
          {lessonCompleted && lessonId && (
            <LessonFeedbackPanel lessonId={lessonId} />
          )}
          <Link
            href="/dashboard/practice"
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Back to Practice
          </Link>
          <Link
            href="/dashboard/learn"
            className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      <FloatingSoundToggle />
      <SessionProgressBar current={index + 1} total={questions.length} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
          {courseName}
          {lessonNumber ? ` · Lesson ${lessonNumber}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">{quizTitle}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Question {index + 1} of {questions.length}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-lg font-medium text-zinc-900">{question.question_text}</p>
        {audioUrl ? (
          <div className="mt-4 flex flex-col items-center gap-2">
            <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playQuestionAudio(NORMAL_SPEECH_RATE)}
                className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Listen
              </button>
              <button
                type="button"
                onClick={() => playQuestionAudio(SLOW_SPEECH_RATE)}
                className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
              >
                Slow
              </button>
            </div>
            {answersLocked ? (
              <p className="text-sm text-zinc-500">
                Listen to the sound first, then choose an answer.
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 space-y-2">
          {options.map((option) => {
            const isSelected = selected === option.key;
            const isCorrectOption = option.key === question.correct_answer;
            const showResult = Boolean(selected);
            const letterName = gurmukhiOptionName(option.label);

            let className =
              "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium text-zinc-900 transition-colors ";

            if (answersLocked) {
              className += "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400";
            } else if (!showResult) {
              className +=
                "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50";
            } else if (isCorrectOption) {
              className += "border-green-300 bg-green-50 text-green-900";
            } else if (isSelected) {
              className += "border-red-300 bg-red-50 text-red-900";
            } else {
              className += "border-zinc-200 bg-zinc-50 text-zinc-700";
            }

            return (
              <button
                key={option.key}
                type="button"
                disabled={answersLocked}
                onClick={() => handleSelect(option.key)}
                className={className}
              >
                <span className="font-semibold uppercase">{option.key}.</span>{" "}
                <span className="text-lg">{option.label}</span>
                {letterName ? (
                  <span className="ml-2 text-sm font-medium text-violet-600">
                    {letterName}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {showNextButton && (
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500"
        >
          {index + 1 >= questions.length ? "See results" : "Next question"}
        </button>
      )}
    </div>
  );
}
