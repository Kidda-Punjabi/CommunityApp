import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-violet-50/80 via-zinc-50 to-zinc-50">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col pb-24">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
