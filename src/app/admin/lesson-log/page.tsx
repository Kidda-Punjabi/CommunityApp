import { AdminLessonLogSection } from "@/components/admin/lesson-log/admin-lesson-log-section";
import { ui } from "@/lib/ui/styles";

export default function AdminLessonLogPage() {
  return (
    <div className={ui.page}>
      <AdminLessonLogSection />
    </div>
  );
}
