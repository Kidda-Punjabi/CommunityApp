import { AudioReviewTab } from "@/app/admin/content/components/audio-review-tab";
import { AdminContentSubNav } from "@/components/admin/admin-content-sub-nav";
import { ui } from "@/lib/ui/styles";

export default function AdminAudioReviewPage() {
  return (
    <div className={ui.page}>
      <AdminContentSubNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Audio review</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Bulk triage for generated audio across lessons, dictionary, comprehension, and more.
        </p>
      </div>
      <AudioReviewTab />
    </div>
  );
}
