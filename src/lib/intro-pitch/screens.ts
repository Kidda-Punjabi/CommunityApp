export type IntroPitchScreen = {
  id: string;
  title: string;
  body?: string;
  bullets?: string[];
  cards?: Array<{ title: string; description: string }>;
  visual?: "welcome" | "pain" | "barriers" | "approach" | "outcomes" | "cta";
};

export const INTRO_PITCH_SCREENS: IntroPitchScreen[] = [
  {
    id: "welcome",
    title: "Because some conversations are worth having in Punjabi",
    body: "Whether you're starting from scratch or picking up where you left off, Kidda helps you learn in a way that actually sticks.",
    visual: "welcome",
  },
  {
    id: "for-you",
    title: "This is for you if…",
    bullets: [
      "You freeze when Punjabi is spoken — even though you understand parts of it",
      "You nod along at family gatherings instead of joining the conversation",
      "You feel embarrassed that you don't speak the language",
      "You've missed real moments with family because of the language gap",
      "You've tried apps or YouTube but haven't made real progress",
    ],
    visual: "pain",
  },
  {
    id: "why-hard",
    title: "Why learning Punjabi is hard",
    cards: [
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
    visual: "barriers",
  },
  {
    id: "how-kidda-works",
    title: "How Kidda works",
    body: "Different tools for different needs — pick what fits you, not a one-size-fits-all ladder.",
    cards: [
      {
        title: "Small live group classes",
        description:
          "Learn foundations alongside others at the same stage — typically 6–8 people in a supportive group.",
      },
      {
        title: "One-to-one tutoring",
        description:
          "Focused, personalised work on pronunciation and core vocabulary when you want individual attention from day one.",
      },
      {
        title: "Ongoing community",
        description:
          "Practice, community classes, and accountability once the basics are in place — or if you already have some Punjabi and want connection.",
      },
    ],
    visual: "approach",
  },
  {
    id: "outcomes",
    title: "What you'll achieve",
    bullets: [
      "Speak Punjabi in everyday conversations — not just rehearsed phrases",
      "Understand what others are saying, even when they speak naturally",
      "Build sentences yourself instead of memorising scripts",
      "Feel connected to the language and culture, not on the outside looking in",
    ],
    visual: "outcomes",
  },
  {
    id: "cta",
    title: "Want full support from a real tutor?",
    body: "Book a free call with our team. We'll help you figure out the right path — no pressure, no sales pitch on the call.",
    visual: "cta",
  },
];

export const INTRO_PITCH_TOTAL_SCREENS = INTRO_PITCH_SCREENS.length;
