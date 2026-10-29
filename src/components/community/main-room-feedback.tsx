"use client";

import { LessonFeedbackForm } from "@/components/feedback/lesson-feedback-form";
import type { MainRoomFeedback } from "@/lib/community/session-feedback";
import { useState } from "react";

/**
 * Shown on every phone once the host brings everyone back: the real Community feedback
 * form for this session. Answers save to the feedback database and sync to Notion.
 */
export function MainRoomFeedbackCard({ feedback }: { feedback: MainRoomFeedback }) {
  const [done, setDone] = useState(false);

  if (feedback.mode === "unavailable") return null;

  if (feedback.mode === "sent" || done) {
    return (
      <section className="rounded-[24px] bg-white p-5 text-[#1F1640]">
        <p className="font-heading text-xl font-extrabold">Thanks for your feedback</p>
        <p className="mt-1 text-sm text-zinc-600">
          It helps plan next week. Stay on the call for the last part.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] bg-white p-5 text-[#1F1640]">
      <p className="font-heading text-xl font-extrabold">How was today&apos;s session?</p>
      <p className="mt-1 text-sm text-zinc-600">Three quick ratings and a comment. Takes a minute.</p>
      {feedback.mode === "preview" ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {feedback.reason === "test"
            ? "Test session: this is what members see. Nothing you enter here is sent."
            : "You're staff, so this is a preview. Members' answers go to Notion."}
        </p>
      ) : null}
      <div className="mt-4">
        <LessonFeedbackForm
          context={feedback.context}
          sessionId={feedback.mode === "form" ? feedback.sessionId : null}
          compact
          previewOnly={feedback.mode === "preview"}
          onSubmitted={() => {
            if (feedback.mode === "form") setDone(true);
          }}
        />
      </div>
    </section>
  );
}
