import { AdminPackagesSection } from "@/components/admin/packages/admin-packages-section";
import {
  KIDS_PURCHASE_QUEUE_VIEW_ID,
  KIDS_PURCHASE_QUEUE_VIEW_QUERY,
} from "@/lib/admin/kids-purchase-grant-queue-types";

export default async function AdminPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <AdminPackagesSection
      initialViewId={view === KIDS_PURCHASE_QUEUE_VIEW_QUERY ? KIDS_PURCHASE_QUEUE_VIEW_ID : null}
    />
  );
}
