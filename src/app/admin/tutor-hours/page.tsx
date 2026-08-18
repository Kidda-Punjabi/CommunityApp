import { isMasterAdmin } from "@/lib/auth/admin-access";
import { AdminTutorHoursSection } from "@/components/admin/tutor-hours/admin-tutor-hours-section";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function AdminTutorHoursPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isMasterAdmin(user.id, supabase))) {
    redirect("/admin/content");
  }

  return (
    <Suspense fallback={<p className="px-5 py-7 text-sm text-zinc-500">Loading…</p>}>
      <AdminTutorHoursSection />
    </Suspense>
  );
}
