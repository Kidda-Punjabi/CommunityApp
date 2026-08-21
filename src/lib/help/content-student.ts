import type { HelpContent } from "@/lib/help/types";

export const STUDENT_HELP: HelpContent = {
  audience: "student",
  title: "Help articles",
  intro:
    "Everything you need to use Kidda as a learner — lessons, homework, live sessions, games, and your account.",
  sections: [
    {
      id: "getting-started",
      title: "Getting started",
      articles: [
        {
          id: "nav",
          question: "How do I find my way around the app?",
          answer:
            "Use the bottom navigation: Home for course lessons, Practise for your path and unlockables, Games for practice games, Community for the leaderboard and live sessions, and Profile for account settings.",
          links: [
            { label: "Go to Home", href: "/dashboard/learn" },
            { label: "Open Practise", href: "/dashboard/home" },
          ],
        },
        {
          id: "courses",
          question: "How do I access my course after buying?",
          answer:
            "After purchase, your course unlocks automatically within a few minutes. Open Home and pick your course track. If something is still locked, check Profile → Billing & purchases or contact the team.",
          links: [
            { label: "Open Home", href: "/dashboard/learn" },
            { label: "Billing & purchases", href: "/dashboard/profile/billing" },
            { label: "Browse courses", href: "/courses" },
          ],
        },
        {
          id: "locked-lessons",
          question: "Why is a lesson locked?",
          answer:
            "For live courses (Foundational and Beginners), your tutor unlocks lessons as you progress. Group cohort lessons unlock for the whole class when your tutor is ready. Community content follows the schedule on the Community tab.",
          links: [{ label: "Open Home", href: "/dashboard/learn" }],
        },
      ],
    },
    {
      id: "homework",
      title: "Homework & lessons",
      articles: [
        {
          id: "submit-homework",
          question: "How do I submit homework?",
          answer:
            "Open Home, choose your course, then open the lesson for this week. Scroll to the Homework section, tap Record, speak your answer, and tap Submit. You need microphone permission. You can only submit once per lesson — review before sending.",
          links: [
            { label: "Go to Home", href: "/dashboard/learn" },
            { label: "Foundational lessons", href: "/dashboard/learn/foundational" },
            { label: "Beginners lessons", href: "/dashboard/learn/beginners" },
          ],
        },
        {
          id: "homework-feedback",
          question: "How do I see homework feedback?",
          answer:
            "Your tutor reviews recordings and you'll get a notification when feedback is ready. Open the same lesson in Home to see whether your homework was approved and read any comments.",
          links: [
            { label: "Notifications", href: "/dashboard/notifications" },
            { label: "Notification settings", href: "/dashboard/profile/notifications" },
          ],
        },
        {
          id: "lesson-materials",
          question: "Where are lesson audio, PDFs, and recordings?",
          answer:
            "Inside each lesson in Home you'll find audio, downloadable PDFs where available, and session recordings after live classes. Tap a lesson card to expand materials.",
          links: [{ label: "Open Home", href: "/dashboard/learn" }],
        },
        {
          id: "quizzes-flashcards",
          question: "How do quizzes and flashcards work?",
          answer:
            "Open Practice from a lesson or use Games for extra drills. Quizzes test what you've learned; flashcards help you memorise vocabulary. XP from activities counts toward your learner level on Profile.",
          links: [
            { label: "Games hub", href: "/dashboard/games" },
            { label: "Your progression", href: "/dashboard/profile" },
          ],
        },
      ],
    },
    {
      id: "live",
      title: "Live sessions & schedule",
      articles: [
        {
          id: "upcoming-lessons",
          question: "Where do I see my upcoming live lessons?",
          answer:
            "Open Schedule (from Practise or your course) to see upcoming sessions with your tutor. Join links appear when it's time for class. Add sessions to your own calendar when prompted.",
          links: [{ label: "Upcoming lessons", href: "/dashboard/schedule" }],
        },
        {
          id: "group-lesson-changes",
          question: "Can I reschedule a group lesson?",
          answer:
            "Group cohort sessions can’t be moved to a different time, and once your cohort has started you can’t permanently switch to another cohort. If you can’t attend a scheduled group session, give at least 7 days’ notice so we can try to offer an alternative that same week when available. Missed group sessions aren’t refundable. 1–1 lessons can be rescheduled with at least 24 hours’ notice.",
          links: [
            { label: "Upcoming lessons", href: "/dashboard/schedule" },
            { label: "Cancellations & Refunds", href: "/dashboard/profile/help/cancellations-refunds" },
            { label: "Changing cohorts", href: "/dashboard/profile/help/changing-cohorts" },
          ],
        },
        {
          id: "events",
          question: "What are Community events?",
          answer:
            "Community events are live sessions and meetups — especially for Kidda Community members. Open the Community tab to see what's on and join when a session is live.",
          links: [{ label: "Community", href: "/dashboard/community" }],
        },
        {
          id: "miss-class",
          question: "What if I miss a live class?",
          answer:
            "Session recordings are posted on the lesson when available. Catch up in Home, complete homework, and message your cohort or tutor if you need help.",
          links: [{ label: "Open Home", href: "/dashboard/learn" }],
        },
      ],
    },
    {
      id: "practice",
      title: "Games & practice",
      articles: [
        {
          id: "games",
          question: "What can I do in Games?",
          answer:
            "Games include flashcards, verb conjugation, memory games, sentence builder, and more. Many games unlock based on your course progress. Use them between lessons to build speed and confidence.",
          links: [{ label: "Games hub", href: "/dashboard/games" }],
        },
        {
          id: "leaderboard",
          question: "How does the leaderboard work?",
          answer:
            "Earn points from lessons, games, and challenges. Open Leaderboard to see how you compare with friends and the wider community.",
          links: [{ label: "Leaderboard", href: "/dashboard/leaderboard" }],
        },
        {
          id: "friends-challenges",
          question: "How do friends and challenges work?",
          answer:
            "Add friends from Profile, then challenge them to games. You can also invite friends with your referral link to earn rewards when they join.",
          links: [
            { label: "Friends", href: "/dashboard/friends" },
            { label: "Profile & invites", href: "/dashboard/profile" },
          ],
        },
      ],
    },
    {
      id: "account",
      title: "Account & billing",
      articles: [
        {
          id: "profile-edit",
          question: "How do I update my name or photo?",
          answer: "Open Profile → Edit profile to change your display name, preferred name, or avatar photo.",
          links: [{ label: "Edit profile", href: "/dashboard/profile/edit" }],
        },
        {
          id: "billing",
          question: "Where do I see purchases and subscriptions?",
          answer:
            "Profile → Billing & purchases shows your access, subscription status, and payment history. Use promo codes at Stripe checkout when buying a course.",
          links: [{ label: "Billing & purchases", href: "/dashboard/profile/billing" }],
        },
        {
          id: "student-discount",
          question: "How do I apply for a student or Blue Light discount?",
          answer:
            "On the Beginners course page, scroll to Student & Blue Light discount, choose your format, upload your ID or Blue Light Card, and submit. We'll email you a promo code when approved.",
          links: [
            { label: "Beginners course", href: "/courses/beginners" },
            { label: "Book a call with us", href: "/book-call" },
          ],
        },
        {
          id: "notifications",
          question: "How do I manage notifications?",
          answer:
            "Profile → Notification settings lets you turn friend requests, homework feedback, announcements, and other alerts on or off.",
          links: [{ label: "Notification settings", href: "/dashboard/profile/notifications" }],
        },
        {
          id: "tutor-access",
          question: "I'm also a tutor — where is the tutor dashboard?",
          answer:
            "If you have tutor access, open Profile and tap Open tutor dashboard. You can switch back to your learner profile anytime from the tutor Profile tab.",
          links: [
            { label: "Learner profile", href: "/dashboard/profile" },
            { label: "Tutor dashboard", href: "/dashboard/tutor" },
          ],
        },
      ],
    },
  ],
};
