import { notFound } from "next/navigation";
import { VerbConjugatorExplorer } from "@/components/resources/verb-conjugator/verb-explorer";
import { loadVerbById } from "@/lib/conjugation/load-verbs";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ verbId: string }>;
};

export default async function VerbConjugatorDetailPage({ params }: PageProps) {
  const { verbId } = await params;
  const supabase = await createClient();
  const verb = await loadVerbById(supabase, verbId);

  if (!verb) notFound();

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <VerbConjugatorExplorer verb={verb} />
    </div>
  );
}
