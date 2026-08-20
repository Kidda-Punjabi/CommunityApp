import type { HelpContent } from "@/lib/help/types";

export const TUTOR_HELP: HelpContent = {
  audience: "tutor",
  title: "Help articles",
  intro:
    "Step-by-step guides for tutors — attendance, homework, lesson unlocks, recordings, calendar, and student requests.",
  sections: [
    {
      id: "overview",
      title: "Tutor dashboard overview",
      articles: [
        {
          id: "nav",
          question: "How do I navigate the tutor app?",
          answer:
            "Bottom nav: Home (overview), Attendance (mark who attended), Homework (review submissions), Lessons (cohorts & students), Calendar (sessions & requests), Profile (settings & learner switch).",
          links: [
            { label: "Tutor home", href: "/dashboard/tutor" },
            { label: "Tutor profile", href: "/dashboard/tutor/profile" },
          ],
        },
        {
          id: "cohorts-vs-students",
          question: "What's the difference between cohorts and 1-to-1 students?",
          answer:
            "Group cohorts share one schedule and unlock lessons together. 1-to-1 students have individual progress — unlock lessons per student from their student page. Use Lessons to find either type.",
          links: [{ label: "Lessons", href: "/dashboard/tutor/lessons" }],
        },
      ],
    },
    {
      id: "attendance",
      title: "Attendance",
      articles: [
        {
          id: "mark-attendance",
          question: "How do I mark attendance?",
          answer:
            "Open Attendance, pick the session date, and tick students who attended. Save before leaving. Attendance feeds admin reporting and helps track engagement.",
          links: [{ label: "Attendance", href: "/dashboard/tutor/attendance" }],
        },
        {
          id: "attendance-when",
          question: "When should I mark attendance?",
          answer:
            "Mark attendance during or right after each live session while the class list is fresh. You can edit the same session later if you need to correct a mistake.",
          links: [{ label: "Attendance", href: "/dashboard/tutor/attendance" }],
        },
      ],
    },
    {
      id: "homework",
      title: "Homework review",
      articles: [
        {
          id: "review-homework",
          question: "How do I review student homework?",
          answer:
            "Open Homework to see pending submissions. Play each recording, add feedback if needed, then Approve or Request resubmit. Students get a notification when you review.",
          links: [{ label: "Homework inbox", href: "/dashboard/tutor/homework" }],
        },
        {
          id: "homework-tips",
          question: "What should I tell students about homework?",
          answer:
            "Students submit from Learn → open the lesson → Homework section → Record → Submit. They can only submit once per lesson, so remind them to check audio before sending.",
          links: [{ label: "Lessons (see student view)", href: "/dashboard/tutor/lessons" }],
        },
      ],
    },
    {
      id: "lessons",
      title: "Lessons & unlocks",
      articles: [
        {
          id: "unlock-cohort",
          question: "How do I unlock lessons for a group cohort?",
          answer:
            "Lessons → open the cohort → use lesson controls to unlock the next lesson for everyone. Students see new content in Learn immediately after unlock.",
          links: [{ label: "Lessons", href: "/dashboard/tutor/lessons" }],
        },
        {
          id: "unlock-1to1",
          question: "How do I unlock lessons for a 1-to-1 student?",
          answer:
            "Lessons → open the student → unlock lessons individually based on their pace. Their Learn tab only shows lessons you've unlocked for them.",
          links: [{ label: "Lessons", href: "/dashboard/tutor/lessons" }],
        },
        {
          id: "session-recordings",
          question: "How do I add session recordings?",
          answer:
            "After a live class, upload or link the session recording on the relevant lesson so students can catch up. Open the cohort or student lesson page and use the recording section.",
          links: [{ label: "Lessons", href: "/dashboard/tutor/lessons" }],
        },
      ],
    },
    {
      id: "calendar",
      title: "Calendar & scheduling",
      articles: [
        {
          id: "calendar-sync",
          question: "How do I sync my Google Calendar?",
          answer:
            "Profile → Calendar settings (or Calendar tab) to connect Google. Synced events show your Kidda sessions alongside personal appointments so you avoid double-booking.",
          links: [
            { label: "Calendar", href: "/dashboard/tutor/calendar" },
            { label: "Tutor profile", href: "/dashboard/tutor/profile" },
          ],
        },
        {
          id: "student-requests",
          question: "How do I handle reschedule or cohort switch requests?",
          answer:
            "1-to-1 students can request reschedules (48 hours notice). Group cohort students cannot reschedule — they can only request to join a different cohort, and only if they give at least 3 days notice. Open Calendar or Requests to approve or decline pending items.",
          links: [
            { label: "Calendar", href: "/dashboard/tutor/calendar" },
            { label: "Requests", href: "/dashboard/tutor/requests" },
          ],
        },
      ],
    },
    {
      id: "account",
      title: "Your tutor account",
      articles: [
        {
          id: "switch-learner",
          question: "How do I switch back to my learner profile?",
          answer:
            "Tutor Profile → Back to learner dashboard. Your learner progress and tutor tools stay separate but use the same login.",
          links: [
            { label: "Tutor profile", href: "/dashboard/tutor/profile" },
            { label: "Learner profile", href: "/dashboard/profile" },
          ],
        },
        {
          id: "notifications",
          question: "How do I manage tutor notifications?",
          answer:
            "Use notification settings on your learner Profile for email and in-app alerts — homework submissions and student requests use the same account.",
          links: [{ label: "Notification settings", href: "/dashboard/profile/notifications" }],
        },
      ],
    },
  ],
};
