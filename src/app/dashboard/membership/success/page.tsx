import { redirect } from "next/navigation";

type LegacySuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

/** Legacy URL — redirects to public checkout success page. */
export default async function MembershipSuccessPage({
  searchParams,
}: LegacySuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  if (sessionId) {
    redirect(`/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
  }
  redirect("/courses");
}
