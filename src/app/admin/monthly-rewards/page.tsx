import { AdminMonthlyRewardsSection } from "@/components/admin/monthly-rewards/admin-monthly-rewards-section";
import { Suspense } from "react";

export default function AdminMonthlyRewardsPage() {
  return (
    <Suspense fallback={<p className="px-5 py-7 text-sm text-zinc-500">Loading…</p>}>
      <AdminMonthlyRewardsSection />
    </Suspense>
  );
}
