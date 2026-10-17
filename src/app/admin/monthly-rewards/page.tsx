import { AdminMonthlyRewardsSection } from "@/components/admin/monthly-rewards/admin-monthly-rewards-section";
import { InlineSpinner } from "@/components/ui/page-spinner";
import { Suspense } from "react";

export default function AdminMonthlyRewardsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center px-5 py-7"><InlineSpinner /></div>}>
      <AdminMonthlyRewardsSection />
    </Suspense>
  );
}
