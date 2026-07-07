import { AdminNotionSyncSection } from "@/components/admin/packages/admin-notion-sync-section";
import { ui } from "@/lib/ui/styles";

export default function AdminPackagesNotionPage() {
  return (
    <div className={ui.page}>
      <AdminNotionSyncSection />
    </div>
  );
}
