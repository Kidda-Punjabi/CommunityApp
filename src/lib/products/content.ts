export type ProductSlug = "foundational" | "beginners" | "community";

export type ProductFeature = {
  title: string;
  description: string;
  icon?: string;
};

export type ProductPricingTier = {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  features: string[];
  checkoutKey: string;
  highlight?: boolean;
};

export type ProductFaqItem = {
  question: string;
  answer: string;
};

export type ProductPageContent = {
  slug: ProductSlug;
  tier: "foundational" | "beginners" | "community";
  heroBadge?: string;
  heroTitle: string;
  heroHighlight?: string;
  heroSubtitle: string;
  heroCta: string;
  features: ProductFeature[];
  featuresSectionTitle?: string;
  pricingSectionTitle?: string;
  pricingTiers?: ProductPricingTier[];
  singlePrice?: { label: string; price: string; priceNote?: string; checkoutKey: string };
  includedItems?: string[];
  includedSectionTitle?: string;
  curriculum?: Array<{ week: number; emoji: string; title: string; description: string }>;
  curriculumSectionTitle?: string;
  audience?: { title: string; items: string[] };
  audienceSectionTitle?: string;
  scheduleNote?: string;
  faq: ProductFaqItem[];
  footerNote?: string;
};

export const PRODUCT_SLUGS: ProductSlug[] = ["foundational", "beginners", "community"];

export function getProductContent(slug: ProductSlug): ProductPageContent {
  const content: Record<ProductSlug, ProductPageContent> = {
    foundational: FOUNDATIONAL_CONTENT,
    beginners: BEGINNERS_CONTENT,
    community: COMMUNITY_CONTENT,
  };
  return content[slug];
}

export function productPath(slug: ProductSlug): string {
  return `/courses/${slug}`;
}

const FOUNDATIONAL_CONTENT: ProductPageContent = {
  slug: "foundational",
  tier: "foundational",
  heroTitle: "Learn to Pronounce Punjabi",
  heroHighlight: "Words in Just 4 Hours!",
  heroSubtitle:
    "4 private 1–1 sessions covering the alphabet, sounds, and real words.",
  heroCta: "I WANT TO LEARN PUNJABI!",
  featuresSectionTitle: "Why the Foundations Course Matters",
  features: [
    {
      icon: "🗣️",
      title: "Clear Punjabi Sounds",
      description:
        "We focus on mouth positioning and sound differences so your pronunciation is clear and consistent.",
    },
    {
      icon: "🔤",
      title: "Alphabet & Vowel System",
      description:
        "Understand the Punjabi alphabet, laga maatra, and muharni in a logical way so it sticks.",
    },
    {
      icon: "💪",
      title: "Confidence Speaking Out Loud",
      description:
        "You practise out loud in every session so hesitation and freezing start to disappear and you get live feedback.",
    },
    {
      icon: "🌏",
      title: "Cultural Immersion",
      description:
        "With strong pronunciation in place, learning phrases in our Beginners course becomes much easier.",
    },
  ],
  pricingSectionTitle: "Invest in Your Punjabi",
  pricingTiers: [
    {
      id: "refresher",
      name: "Foundational Crash Course",
      price: "£70",
      features: [
        "2 × 60-minute private 1–1 sessions",
        "Flexible scheduling",
        "Punjabi alphabet & Laga maatra",
        "Guided practice building words",
        "Live pronunciation feedback",
        "A refresher for Punjabi pronunciation",
      ],
      checkoutKey: "foundational-refresher",
    },
    {
      id: "full",
      name: "Full Foundational Course",
      price: "£140",
      highlight: true,
      features: [
        "4 × 60-minute private 1–1 sessions",
        "Flexible scheduling",
        "Learn the Punjabi alphabet",
        "Laga maatra and muharni explained",
        "Guided practice building words",
        "Live pronunciation feedback",
        "A foundation to speaking Punjabi",
      ],
      checkoutKey: "foundational-full",
    },
  ],
  footerNote: "All sessions are recorded and available to watch on-demand.",
  faq: [
    {
      question: "What happens after I purchase?",
      answer:
        "You'll receive a confirmation email and we'll reach out to schedule your first 1–1 session at a time that works for you. Your course unlocks in the Kidda app so you can access supporting materials.",
    },
    {
      question: "Is this course suitable for kids?",
      answer:
        "This course is designed for adults and teens who want structured pronunciation coaching. For children's lessons, please contact us separately.",
    },
    {
      question: "Is this course 1–1 or in a group?",
      answer:
        "Every Foundations session is private 1–1 with an expert tutor, so you get personalised feedback on your pronunciation.",
    },
    {
      question: "Do I need to attend one session per week?",
      answer:
        "No — scheduling is flexible. You can space sessions to fit your calendar. Most learners complete the full course over 2–4 weeks.",
    },
    {
      question: "Will I be fluent in Punjabi after this course?",
      answer:
        "This course focuses on pronunciation and reading foundations, not full conversational fluency. It's the ideal first step before our Beginners course.",
    },
    {
      question: "What will I be able to do after completing the course?",
      answer:
        "You'll pronounce Punjabi sounds clearly, read basic words with laga maatra, and feel confident speaking aloud — ready to move into conversational Punjabi.",
    },
    {
      question: "Do I need to turn my camera and mic on?",
      answer:
        "Yes. This is a speaking-first course. Your tutor needs to see and hear you to give accurate pronunciation feedback.",
    },
    {
      question: "What should I do after the Foundations course?",
      answer:
        "Most learners continue to our 12-week Beginners course to build real conversational skills, or join the Kidda Community for ongoing live practice.",
    },
  ],
};

const BEGINNERS_CONTENT: ProductPageContent = {
  slug: "beginners",
  tier: "beginners",
  heroBadge: "Limited spots per cohort",
  heroTitle: "Speak Punjabi Confidently",
  heroHighlight: "In Just 12 Weeks!",
  heroSubtitle:
    "A 12-week live course to help you speak, understand, and connect with Punjabi culture — choose group lessons or private 1-to-1 tutoring with real instructors.",
  heroCta: "I WANT TO LEARN PUNJABI!",
  scheduleNote: "Next cohort starts: June 20th 2026",
  featuresSectionTitle: "How you'll learn",
  features: [
    {
      icon: "👥",
      title: "Live Group Lessons",
      description:
        "Learn with a supportive community in small batches — real conversation practice every session. You'll build confidence fast as you speak, listen, and learn in real time with others at your level.",
    },
    {
      icon: "🎙️",
      title: "Weekly Speaking Practice",
      description:
        "These short, guided sessions help you turn what's in your head into real words — and before long, you'll be surprised at how naturally you can hold a conversation.",
    },
    {
      icon: "📝",
      title: "Homework & Quizzes",
      description:
        "Fun bite-sized tasks that fit your schedule, designed to make things stick. Each one reinforces what you've learned in class.",
    },
  ],
  includedSectionTitle: "What's Included",
  includedItems: [
    "1 Live Group Lesson per Week – Learn with real instructors in interactive sessions.",
    "Weekly Speaking Practice – Pair up to practise conversations and build confidence.",
    "Homework & Quizzes – Quick, engaging tasks to reinforce what you learn.",
    "Accountability Community – Stay motivated with support from other learners.",
    "Printable Resources – Download study sheets and vocab lists.",
    "Completion Certificate – Earn recognition for finishing your 12-week journey.",
  ],
  curriculumSectionTitle: "What Will We Cover?",
  curriculum: [
    { week: 1, emoji: "👋", title: "Sounds, Greetings & Basics", description: "Learn Punjabi sounds (vowels + tones) and sentence order (SOV). Practise greetings and introductions." },
    { week: 2, emoji: "🗣️", title: 'The Verb "To Be" – ਹੋਣਾ (hona)', description: "Master the present tense: ਮੈਂ ਹਾਂ (I am), ਤੂੰ ਹੈਂ (you are), ਉਹ ਹੈ (he/she is)." },
    { week: 3, emoji: "👤", title: "Nouns, Gender & Adjectives", description: "Understand masculine/feminine agreement and describe people, things, and places." },
    { week: 4, emoji: "📝", title: "Building Simple Sentences", description: 'Practise sentences like "I like X" and "They have X" to describe preferences and possessions.' },
    { week: 5, emoji: "❓", title: "Questions & Negatives", description: "Learn how to ask and deny using ਕੀ (kī) and ਨਹੀਂ (nahīṁ). Perfect for everyday conversations." },
    { week: 6, emoji: "⏰", title: "Present Continuous – ਕਰ ਰਿਹਾ ਹਾਂ", description: "Talk about actions happening right now — describe your day and activities." },
    { week: 7, emoji: "🌅", title: "Talking About Routine", description: "Use habitual sentences like ਮੈਂ ਹਰ ਰੋਜ਼ ਕਰਦਾ ਹਾਂ (I do every day) to talk about routines." },
    { week: 8, emoji: "🔮", title: "Future Intentions", description: "Learn to express plans with ਕਰਾਂਗਾ (will do), ਜਾਣਾ (to go), ਦੇਣਾ (to give)." },
    { week: 9, emoji: "📅", title: "Past Tense (Intro)", description: "Use simple past forms like ਕੀਤਾ (did), ਗਿਆ (went), ਆਇਆ (came) to talk about what happened." },
    { week: 10, emoji: "💪", title: "Helping Verbs & Modals", description: "Learn ਸਕਦਾ (can), ਚਾਹੁੰਦਾ (want to), ਚਾਹੀਦਾ (should) — for ability, desire, and obligation." },
    { week: 11, emoji: "🔗", title: "Combining Ideas", description: "Use connectors like ਅਤੇ (and), ਪਰ (but), ਕਿਉਂਕਿ (because) to express opinions and reasons." },
    { week: 12, emoji: "🎓", title: "Real Conversations & Review", description: 'Bring it all together — full dialogues, mixed tenses, and a final "Day in My Life" project.' },
  ],
  audienceSectionTitle: "Who is this for?",
  audience: {
    title: "Whether you're starting from scratch or reconnecting with your roots, this course is designed for anyone who wants to speak Punjabi with confidence.",
    items: [
      "Beginners – You've always wanted to learn Punjabi but don't know where to start.",
      "Heritage Learners – You understand a few words but struggle to speak fluently.",
      "Travellers & Culture Lovers – You want to connect with Punjabi people, traditions, and music.",
      "Parents & Families – You'd love to speak Punjabi at home and pass it on to the next generation.",
      "Sikhs Reconnecting Spiritually – You want to understand paath, simran, and katha more deeply through language.",
    ],
  },
  pricingSectionTitle: "Invest in Your Punjabi",
  pricingTiers: [
    {
      id: "group",
      name: "12-Week Group Course",
      price: "£400",
      priceNote: "Live group lessons · 12 weeks · completion certificate",
      highlight: true,
      features: [
        "1 live group lesson per week with real instructors",
        "Weekly speaking practice with other learners",
        "Homework, quizzes, and printable resources",
        "Accountability community and completion certificate",
      ],
      checkoutKey: "beginners-group",
    },
    {
      id: "one-to-one",
      name: "12-Week 1-to-1 Course",
      price: "£480",
      priceNote: "Private lessons with your tutor · flexible pacing · completion certificate",
      features: [
        "Private 1-to-1 lessons tailored to your pace",
        "Personalised feedback and speaking practice",
        "Homework, quizzes, and printable resources",
        "Completion certificate when you finish",
      ],
      checkoutKey: "beginners-one-to-one",
    },
  ],
  faq: [
    {
      question: "Do I need to know any Punjabi before joining?",
      answer:
        "No prior Punjabi is required. We start from the basics. If you've done our Foundations course, you'll have a head start on pronunciation.",
    },
    {
      question: "How are the lessons taught?",
      answer:
        "Live group sessions with a real instructor, plus weekly speaking practice, homework, and quizzes. Everything is designed around speaking, not just memorising.",
    },
    {
      question: "What if I miss a class?",
      answer:
        "Sessions are recorded so you can catch up. Your cohort community and homework help you stay on track even if you miss a week.",
    },
    {
      question: "What makes this course different from language apps?",
      answer:
        "Apps help you recognise words. This course helps you use Punjabi through live speaking, feedback, and accountability with real people.",
    },
    {
      question: "Who are the teachers?",
      answer:
        "Experienced Punjabi tutors who specialise in helping heritage learners and beginners speak with confidence.",
    },
    {
      question: "Can children join the course?",
      answer:
        "This cohort is designed for adults. For children's Punjabi lessons, please contact us separately.",
    },
    {
      question: "Will I actually be able to hold a conversation by the end?",
      answer:
        "Yes — that's the goal. By week 12 you'll combine tenses, ask questions, and hold real dialogues about everyday topics.",
    },
    {
      question: "How much time do I need each week?",
      answer:
        "Plan for about 2–3 hours: one live group lesson, speaking practice, and short homework tasks.",
    },
    {
      question: "Will I learn to read and write Punjabi?",
      answer:
        "We introduce Gurmukhi where it helps your speaking. The main focus is conversational fluency, not formal literacy.",
    },
    {
      question: "How big are the group classes?",
      answer:
        "Small cohorts only — we cap enrolment so every learner gets attention and speaking time.",
    },
  ],
};

const COMMUNITY_CONTENT: ProductPageContent = {
  slug: "community",
  tier: "community",
  heroBadge: "🌟 Join 20+ Punjabi Learners",
  heroTitle: "Live Punjabi Speaking Sessions",
  heroHighlight: "from less than £2 per Session",
  heroSubtitle:
    "A supportive Punjabi learning community built around live speaking practice.",
  heroCta: "I WANT TO LEARN PUNJABI!",
  scheduleNote: "2× weekly sessions — Wednesday 7–8 pm or Sunday 10–11 am",
  featuresSectionTitle: "What's included",
  features: [
    {
      icon: "🎥",
      title: "2× Live Weekly Sessions",
      description:
        "Join 2 interactive live classes every week with native Punjabi speakers who make learning fun and engaging.",
    },
    {
      icon: "📚",
      title: "Structured Curriculum",
      description:
        "From Gurmukhi script to fluency, our curriculum takes you from beginner to confident speaker.",
    },
    {
      icon: "🤝",
      title: "Community Support",
      description:
        "Connect with fellow learners, practice together, and get answers to your Punjabi questions in our active community.",
    },
    {
      icon: "🎵",
      title: "Cultural Immersion",
      description:
        "Learn more than just words — discover Punjabi music, poetry, traditions, and the rich heritage of Punjab.",
    },
  ],
  includedSectionTitle: "What will we cover?",
  includedItems: [
    "Common sentence patterns you can reuse naturally",
    "Everyday Punjabi used in real conversations",
    "Listening practice to understand native speakers",
    "Pronunciation and confidence when speaking",
    "How to respond without translating in your head",
    "Practical vocabulary used in family and social settings",
  ],
  pricingSectionTitle: "Invest in Your Punjabi",
  pricingTiers: [
    {
      id: "pro",
      name: "Pro Plan",
      price: "£99/yr",
      priceNote: "~~£199/yr~~ · Use code FOUNDER100 for £100 off",
      highlight: true,
      features: [
        "Speak Punjabi without freezing",
        "Understand real conversations",
        "Stop translating in your head",
        "Feel confident speaking Punjabi",
        "Less than £2/hour",
        "Live sessions with tutors",
      ],
      checkoutKey: "community",
    },
  ],
  footerNote: "All sessions are recorded and available to watch on-demand. Cancel anytime.",
  faq: [
    {
      question: "Do I need to be fluent to join?",
      answer:
        "No. This community is designed for beginners and heritage learners who understand some Punjabi but struggle to speak. You don't need confidence to start — you build it here.",
    },
    {
      question: "What if I feel nervous speaking?",
      answer:
        "That's completely normal. Sessions are supportive, guided, and judgement-free. Everyone is learning, and making mistakes is expected.",
    },
    {
      question: "Do I need to attend both live sessions every week?",
      answer:
        "No. Both sessions cover the same topic. Attending one session per week is enough to stay on track. The second session is optional for extra practice.",
    },
    {
      question: "What happens if I miss a session?",
      answer:
        "You won't fall behind. Each topic is taught twice weekly, and recordings are available on-demand.",
    },
    {
      question: "Do I need to turn my camera and mic on?",
      answer:
        "Yes. This is a speaking-first community. Keeping your camera and mic on helps you practise properly and build confidence faster.",
    },
    {
      question: "Is this grammar-heavy?",
      answer:
        "No. We focus on practical Punjabi used in real conversations. Grammar is explained simply and only when it helps you speak better.",
    },
    {
      question: "How is this different from apps or YouTube?",
      answer:
        "Apps and videos help you recognise words. This community helps you use Punjabi through live speaking, feedback, and accountability.",
    },
    {
      question: "Is this suitable if I've tried learning Punjabi before and failed?",
      answer:
        "Yes. Most members have tried before. The difference here is structure, live practice, and support.",
    },
    {
      question: "Will I learn to read and write Punjabi?",
      answer:
        "This community focuses primarily on speaking and understanding Punjabi. Reading and writing are introduced lightly where helpful.",
    },
    {
      question: "Is this for kids? Do you run kids' classes?",
      answer:
        "This community is designed for adults. We don't run children's classes inside this community.",
    },
  ],
};
