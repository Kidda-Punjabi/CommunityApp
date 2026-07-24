import { BOOK_CALL_PATH } from "@/lib/booking/constants";

/**
 * Public “See how it works” narrative — no pricing.
 * Adapted from the approved intro-pitch / sales-deck copy plus Learn path framing.
 * (The brief’s five-section paste did not arrive; swap wording here if Gurupma supplies a final draft.)
 */
export const HOW_IT_WORKS_CONTENT = {
  hero: {
    title: "Because some conversations are worth having in Punjabi",
    body: "Whether you're starting from scratch or picking up where you left off, Kidda helps you learn in a way that actually sticks.",
  },
  pitfalls: {
    title: "Common pitfalls",
    intro: "Most learners hit the same walls — you're not alone in this.",
    items: [
      {
        title: "Not knowing where to start",
        description:
          "Without a clear path, it's easy to jump between random videos and never build real foundations.",
      },
      {
        title: "Trying to learn alone",
        description:
          "Speaking a language needs feedback, practice partners, and someone to keep you accountable.",
      },
      {
        title: "Focusing on words, not conversations",
        description:
          "Memorising vocabulary doesn't help when you're in a real conversation and need to respond naturally.",
      },
    ],
  },
  howWeHelp: {
    title: "How we help",
    intro: "Different tools for different needs — pick what fits you, not a one-size-fits-all ladder.",
    items: [
      {
        title: "Topics you can actually use",
        description:
          "Practical, week-by-week Punjabi for real life — free to try, with no pressure to commit before you're ready.",
      },
      {
        title: "Live teaching that sticks",
        description:
          "Small group classes and one-to-one tutoring so you get feedback, accountability, and real conversation practice.",
      },
      {
        title: "A path that matches your goal",
        description:
          "Pronunciation when you need sounds. Grammar when you're ready to build sentences. Connection when you want community.",
      },
    ],
  },
  path: {
    title: "Recommended path",
    intro:
      "Start with Topics — free to try, practical, no pressure. Ready to go deeper? Foundational teaches pronunciation. Beginners teaches grammar. Pick based on what you want first.",
    options: [
      {
        name: "Topics",
        description: "Free to try. Practical weekly themes — no pressure.",
        hrefLoggedOut: "/signup",
        hrefLoggedIn: "/dashboard/learn",
      },
      {
        name: "Foundational",
        description: "Go deeper on pronunciation and everyday sounds.",
        hrefLoggedOut: "/courses/foundational",
        hrefLoggedIn: "/courses/foundational",
      },
      {
        name: "Beginners",
        description: "Build grammar and the confidence to form your own sentences.",
        hrefLoggedOut: "/courses/beginners",
        hrefLoggedIn: "/courses/beginners",
      },
    ],
  },
  cta: {
    title: "Want full support from a real tutor?",
    body: "Book a free call with our team. We'll help you figure out the right path — no pressure, no sales pitch on the call.",
    primaryHref: BOOK_CALL_PATH,
    primaryLabel: "Book a free call",
    secondaryHref: "/signup",
    secondaryLabel: "Create a free account",
  },
} as const;
