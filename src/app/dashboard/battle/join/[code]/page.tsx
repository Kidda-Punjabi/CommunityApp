import { redirect } from "next/navigation";

type BattleJoinByCodePageProps = {
  params: Promise<{ code: string }>;
};

export default async function BattleJoinByCodePage({ params }: BattleJoinByCodePageProps) {
  const { code } = await params;
  redirect(`/dashboard/battle?code=${encodeURIComponent(code.trim().toUpperCase())}`);
}
