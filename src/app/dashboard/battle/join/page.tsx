import { redirect } from "next/navigation";

type BattleJoinPageProps = {
  searchParams: Promise<{ code?: string }>;
};

export default async function BattleJoinPage({ searchParams }: BattleJoinPageProps) {
  const { code } = await searchParams;
  if (code?.trim()) {
    redirect(`/dashboard/battle?code=${encodeURIComponent(code.trim().toUpperCase())}`);
  }
  redirect("/dashboard/battle");
}
