import type { HelpContent } from "@/lib/help/types";

export const ADMIN_HELP: HelpContent = {
  audience: "admin",
  title: "Help articles",
  intro:
    "Standard operating procedures for Kidda admins — cohorts, members, tutors, curriculum, payments, discounts, and site content.",
  sections: [
    {
      id: "overview",
      title: "Admin overview",
      articles: [
        {
          id: "nav",
          question: "How is the admin dashboard organised?",
          answer:
            "Home shows stats and section links. People covers members, cohorts, tutors, staff, payments, and discount approvals. Learn content is curriculum. Games is practice content. Site is events, announcements, and branding.",
          links: [
            { label: "Admin home", href: "/admin/content" },
            { label: "People", href: "/admin/content/people" },
          ],
        },
        {
          id: "who-can-admin",
          question: "Who can access admin?",
          answer:
            "Only users listed under People → Staff & tutors with admin or staff roles. Tutors without staff access use the tutor dashboard only.",
          links: [{ label: "Staff & tutors", href: "/admin/content/people?tab=staff" }],
        },
      ],
    },
    {
      id: "cohorts",
      title: "Cohorts & allocation",
      articles: [
        {
          id: "view-cohorts",
          question: "How do I see all cohorts and member counts?",
          answer:
            "People → Cohorts lists active cohorts, how many students are in each, setup status, and expandable member lists. Use this to spot empty or full groups.",
          links: [{ label: "Cohorts tab", href: "/admin/content/people?tab=cohorts" }],
        },
        {
          id: "create-cohort",
          question: "How do I create a new cohort?",
          answer:
            "People → Staff & tutors → create or edit a cohort: set name, course, tutor, schedule, and capacity. New group buyers appear as unallocated until you assign them on the Cohorts tab or Members setup.",
          links: [
            { label: "Staff & tutors", href: "/admin/content/people?tab=staff" },
            { label: "Cohorts", href: "/admin/content/people?tab=cohorts" },
          ],
        },
        {
          id: "allocate-students",
          question: "How do I allocate group purchasers to a cohort?",
          answer:
            "People → Cohorts shows unallocated group buyers at the bottom. Assign each student to the right cohort so their tutor sees them in Lessons and they get the correct schedule.",
          links: [{ label: "Cohorts tab", href: "/admin/content/people?tab=cohorts" }],
        },
        {
          id: "members-setup",
          question: "What is Members setup?",
          answer:
            "Members setup is where you link enrollments to cohorts, fix access issues, and confirm a member is ready for their tutor. Use it when someone paid but doesn't appear in the right place.",
          links: [{ label: "Members setup", href: "/admin/content/people?tab=members" }],
        },
      ],
    },
    {
      id: "people",
      title: "Members, tutors & staff",
      articles: [
        {
          id: "enrollments",
          question: "How do I check who is enrolled?",
          answer:
            "People → Members setup and the home stats show enrollment counts. Cross-check with Stripe on the Payments tab for paid access.",
          links: [
            { label: "Members setup", href: "/admin/content/people?tab=members" },
            { label: "Payments", href: "/admin/content/people?tab=payments" },
          ],
        },
        {
          id: "add-tutor",
          question: "How do I add a tutor or staff member?",
          answer:
            "People → Staff & tutors → add the user (they must have signed up first). Set role to tutor, staff, or admin and assign cohorts they teach.",
          links: [{ label: "Staff & tutors", href: "/admin/content/people?tab=staff" }],
        },
        {
          id: "payments",
          question: "How do I review Stripe payments?",
          answer:
            "People → Payments lists recent checkouts and subscriptions. Use this to verify a student paid before manually fixing access.",
          links: [{ label: "Payments", href: "/admin/content/people?tab=payments" }],
        },
        {
          id: "discounts",
          question: "How do I approve student or Blue Light discounts?",
          answer:
            "People → Discounts shows pending applications with uploaded ID. Approve to send the correct promo code email, or reject with a reason. Codes are separate for student vs Blue Light and group vs 1-to-1.",
          links: [{ label: "Discounts", href: "/admin/content/people?tab=student-discounts" }],
        },
      ],
    },
    {
      id: "curriculum",
      title: "Learn content",
      articles: [
        {
          id: "courses-lessons",
          question: "How do I edit courses and lessons?",
          answer:
            "Learn content → pick a course → edit lessons, upload audio/PDFs, set order, and attach quizzes. Changes appear in student Learn after publish/save.",
          links: [{ label: "Learn content", href: "/admin/content/curriculum" }],
        },
        {
          id: "quizzes-flashcards",
          question: "How do I manage quizzes and flashcards?",
          answer:
            "From curriculum, open a lesson's quiz or flashcard sets. Games hub content is managed separately under Games for sentence builder, conjugation, etc.",
          links: [
            { label: "Learn content", href: "/admin/content/curriculum" },
            { label: "Games", href: "/admin/content/games" },
          ],
        },
      ],
    },
    {
      id: "site",
      title: "Site, events & comms",
      articles: [
        {
          id: "events",
          question: "How do I create or edit events?",
          answer:
            "Site & comms → Events to add community sessions, Zoom links, and dates. Students see these under Dashboard → Events.",
          links: [{ label: "Site & comms", href: "/admin/content/site" }],
        },
        {
          id: "announcements",
          question: "How do I send announcements?",
          answer:
            "Site & comms → Announcements to post updates that appear in student notifications and the app feed.",
          links: [{ label: "Site & comms", href: "/admin/content/site" }],
        },
        {
          id: "branding",
          question: "Where do I change site branding or marketing copy?",
          answer:
            "Site & comms includes branding and public-facing settings. Course landing pages pull from product content and Stripe price IDs in environment config.",
          links: [
            { label: "Site & comms", href: "/admin/content/site" },
            { label: "Public courses", href: "/courses" },
          ],
        },
      ],
    },
    {
      id: "sops",
      title: "Common workflows (SOPs)",
      articles: [
        {
          id: "sop-new-group-student",
          question: "SOP: New group course purchase",
          answer:
            "1) Confirm payment in Payments. 2) Check Cohorts for unallocated buyer. 3) Assign to cohort with capacity. 4) Confirm tutor sees them in Lessons. 5) Student opens Learn after tutor unlocks first lesson.",
          links: [
            { label: "Payments", href: "/admin/content/people?tab=payments" },
            { label: "Cohorts", href: "/admin/content/people?tab=cohorts" },
          ],
        },
        {
          id: "sop-new-1to1",
          question: "SOP: New 1-to-1 student",
          answer:
            "1) Verify 1-to-1 purchase in Payments. 2) Members setup — ensure enrollment and tutor assignment. 3) Tutor unlocks lessons individually. 4) Student submits homework from Learn.",
          links: [{ label: "Members setup", href: "/admin/content/people?tab=members" }],
        },
        {
          id: "sop-access-issue",
          question: "SOP: Student says they can't access the course",
          answer:
            "1) Check Payments for successful checkout. 2) Members setup for enrollment row. 3) Group: confirm cohort allocation. 4) Ask student to log out and back in. 5) Escalate to dev if Stripe shows paid but no enrollment.",
          links: [
            { label: "Payments", href: "/admin/content/people?tab=payments" },
            { label: "Members setup", href: "/admin/content/people?tab=members" },
          ],
        },
        {
          id: "sop-discount",
          question: "SOP: Student discount application",
          answer:
            "1) Open Discounts tab. 2) Verify ID image and format (group vs 1-to-1). 3) Approve — system emails promo code. 4) Student applies code at Stripe checkout on Beginners page.",
          links: [
            { label: "Discounts", href: "/admin/content/people?tab=student-discounts" },
            { label: "Beginners course page", href: "/courses/beginners" },
          ],
        },
      ],
    },
  ],
};
