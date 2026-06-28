import { AdminShell } from "@/components/admin/admin-shell";
import { loadAdminData } from "@/lib/admin/load-admin-data";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminServerError } from "./admin-server-error";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await canAccessAdminPanel(user, supabase))) redirect("/dashboard/home");

  const result = await loadAdminData();
  if (!result.ok) {
    return <AdminServerError message={result.error} />;
  }

  return (
    <AdminShell data={result.data} branding={result.branding}>
      {children}
    </AdminShell>
  );
}
