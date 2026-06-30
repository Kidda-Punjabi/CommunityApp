import { HelpArticlesView } from "@/components/help/help-articles-view";
import { getHelpBackHref, getHelpContent } from "@/lib/help";

export default function AdminHelpPage() {
  const content = getHelpContent("admin");

  return (
    <HelpArticlesView
      content={content}
      backHref={getHelpBackHref("admin")}
      backLabel="Back to admin home"
    />
  );
}
