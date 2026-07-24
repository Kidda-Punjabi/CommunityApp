import { HowItWorksPage } from "@/components/marketing/how-it-works-page";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How Kidda works | Kidda",
  description:
    "Why learning Punjabi is hard, how Kidda helps, and a simple path from Topics to Foundational and Beginners — with no pressure.",
};

export default async function HowItWorksRoutePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <HowItWorksPage isLoggedIn={Boolean(user)} />;
}
