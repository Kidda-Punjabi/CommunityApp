import { HelpArticlesView } from "@/components/help/help-articles-view";
import { getHelpBackHref, getHelpContent } from "@/lib/help";

export default function TutorHelpPage() {
  const content = getHelpContent("tutor");

  return (
    <HelpArticlesView
      content={content}
      backHref={getHelpBackHref("tutor")}
      backLabel="Back to tutor profile"
    />
  );
}
