export type HelpAudience = "student" | "tutor" | "admin";

export type HelpLink = {
  label: string;
  href: string;
};

export type HelpArticle = {
  id: string;
  question: string;
  answer: string;
  links?: HelpLink[];
};

export type HelpSection = {
  id: string;
  title: string;
  description?: string;
  articles: HelpArticle[];
};

export type HelpContent = {
  audience: HelpAudience;
  title: string;
  intro: string;
  sections: HelpSection[];
};
