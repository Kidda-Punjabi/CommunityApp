import { HelpArticlesView } from "@/components/help/help-articles-view";
import { getHelpBackHref, getHelpContent } from "@/lib/help";

export default function StudentHelpPage() {
  const content = getHelpContent("student");

  return (
    <HelpArticlesView
      content={content}
      backHref={getHelpBackHref("student")}
      backLabel="Back to profile"
    />
  );
}
