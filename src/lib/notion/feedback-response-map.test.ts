import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isFeedbackToReview,
  isTestimonialPending,
  mergeFeedbackResponseRow,
  parseNotionFeedbackPage,
} from "./feedback-response-map";

describe("parseNotionFeedbackPage", () => {
  it("reads select, status, number, formula, and title fields", () => {
    const parsed = parseNotionFeedbackPage({
      id: "page-1",
      last_edited_time: "2026-09-12T10:00:00.000Z",
      properties: {
        "Full Name": { rich_text: [{ plain_text: "Amrita Singh" }] },
        Email: { rich_text: [{ plain_text: "amrita@example.com" }] },
        Tutor: { select: { name: "Arshdeep Kaur" } },
        Cohort: { select: { name: "Cohort 41" } },
        Course: { select: { name: "Beginners Course" } },
        Lesson: { select: { name: "Lesson 12" } },
        "Feedback Date": { date: { start: "2026-09-01" } },
        "Learning Relevance": { number: 5 },
        Confidence: { number: 2 },
        "Tutor Effectiveness": { number: 4 },
        "Overall Score": { number: 3.2 },
        "Video Testimonial?": { select: { name: "Yes" } },
        "Video Testimonial Recorded": { status: { name: "Need to Message" } },
        Actioned: { status: { name: "Not started" } },
        "Critical Feedback": { formula: { boolean: true } },
        Comments: { rich_text: [{ plain_text: "Needed more time" }] },
        Notes: { title: [{ plain_text: "Needed more time" }] },
      },
    });
    assert.equal(parsed.fullName, "Amrita Singh");
    assert.equal(parsed.tutor, "Arshdeep Kaur");
    assert.equal(parsed.criticalFeedback, true);
    assert.equal(parsed.overallScore, 3.2);
    assert.equal(parsed.actioned, "Not started");
  });
});

describe("mergeFeedbackResponseRow", () => {
  const incoming = {
    notionPageId: "page-1",
    fullName: "A",
    email: "a@x.com",
    tutor: "Arshdeep Kaur",
    cohort: "Cohort 41",
    course: "Beginners Course",
    lesson: "Lesson 4",
    feedbackDate: "2026-09-01",
    learningRelevance: 4,
    confidence: 4,
    tutorEffectiveness: 4,
    understanding: null,
    speaking: null,
    understandingGrammar: null,
    clarityStructure: null,
    conceptBreakdown: null,
    supportiveness: null,
    overallScore: null,
    videoTestimonial: null,
    videoTestimonialRecorded: "Need to Message",
    actioned: "Done",
    criticalFeedback: false,
    comments: null,
    notes: "n",
    notionLastEditedTime: "2026-09-12T10:00:00.000Z",
  };

  it("keeps dashboard two-way values when local_updated_at is newer", () => {
    const merged = mergeFeedbackResponseRow(incoming, {
      actioned: "Pending",
      video_testimonial_recorded: "Time Booked",
      local_updated_at: "2026-09-12T11:00:00.000Z",
    });
    assert.equal(merged.keepLocalTwoWay, true);
    assert.equal(merged.actioned, "Pending");
    assert.equal(merged.videoTestimonialRecorded, "Time Booked");
  });

  it("lets Notion win when last_edited_time is newer", () => {
    const merged = mergeFeedbackResponseRow(incoming, {
      actioned: "Pending",
      video_testimonial_recorded: "Time Booked",
      local_updated_at: "2026-09-12T09:00:00.000Z",
    });
    assert.equal(merged.keepLocalTwoWay, false);
    assert.equal(merged.actioned, "Done");
    assert.equal(merged.videoTestimonialRecorded, "Need to Message");
  });
});

describe("review and testimonial gates", () => {
  it("flags lesson 12 testimonials that are not in a terminal recorded status", () => {
    assert.equal(
      isTestimonialPending({
        lesson: "Lesson 12",
        videoTestimonial: "Yes",
        videoTestimonialRecorded: "Need to Message",
      }),
      true
    );
    assert.equal(
      isTestimonialPending({
        lesson: "Lesson 12",
        videoTestimonial: "Yes",
        videoTestimonialRecorded: "Time Booked",
      }),
      false
    );
  });

  it("reviews critical formula rows or overall scores below 3.5", () => {
    assert.equal(isFeedbackToReview({ criticalFeedback: true, overallScore: 5 }, 3.5), true);
    assert.equal(isFeedbackToReview({ criticalFeedback: false, overallScore: 3.2 }, 3.5), true);
    assert.equal(isFeedbackToReview({ criticalFeedback: false, overallScore: 4 }, 3.5), false);
  });
});
