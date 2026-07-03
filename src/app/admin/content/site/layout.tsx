import { AdminDataHydrator } from "@/components/admin/admin-data-hydrator";
import { AdminServerError } from "@/app/admin/content/admin-server-error";
import { loadAdminSiteData } from "@/lib/admin/load-admin-data";

export default async function AdminSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await loadAdminSiteData();
  if (!result.ok) {
    return <AdminServerError message={result.error} />;
  }

  return (
    <>
      <AdminDataHydrator data={result.data} slice="site" />
      {children}
    </>
  );
}
