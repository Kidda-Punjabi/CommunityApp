import { requireForumAccessAllowed } from "@/lib/kids/guards";

export default async function ForumLayout({ children }: { children: React.ReactNode }) {
  await requireForumAccessAllowed();
  return children;
}
