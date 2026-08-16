import { requireNoKidCommunityAccess } from "@/lib/kids/guards";

export default async function GroupGamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireNoKidCommunityAccess();
  return children;
}
