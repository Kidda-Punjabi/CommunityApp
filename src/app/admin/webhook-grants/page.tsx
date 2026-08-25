import { AdminWebhookGrantsSection } from "@/components/admin/webhook-grants/admin-webhook-grants-section";
import { Suspense } from "react";

export default function AdminWebhookGrantsPage() {
  return (
    <Suspense fallback={<p className="px-5 py-7 text-sm text-zinc-500">Loading…</p>}>
      <AdminWebhookGrantsSection />
    </Suspense>
  );
}
