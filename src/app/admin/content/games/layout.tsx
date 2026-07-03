import { AdminDataHydrator } from "@/components/admin/admin-data-hydrator";
import { AdminServerError } from "@/app/admin/content/admin-server-error";
import { loadAdminCurriculumData } from "@/lib/admin/load-admin-data";

export default async function AdminGamesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await loadAdminCurriculumData();
  if (!result.ok) {
    return <AdminServerError message={result.error} />;
  }

  return (
    <>
      <AdminDataHydrator data={result.data} slice="curriculum" />
      {children}
    </>
  );
}
