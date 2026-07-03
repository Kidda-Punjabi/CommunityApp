import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { AdminDataShell } from "@/components/admin/admin-data-shell";
import { AdminWidthContainer } from "@/components/admin/admin-width-container";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import type { AdminDataSlice } from "@/lib/admin/merge-admin-data-slice";
import type { AdminData } from "@/app/admin/content/types";
import type { SiteBranding } from "@/lib/branding/types";
import Link from "next/link";

type AdminShellProps = {
  data: AdminData;
  branding: SiteBranding;
  dataSlice?: AdminDataSlice;
  children: React.ReactNode;
};

export function AdminShell({ data, branding, dataSlice = "full", children }: AdminShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white">
        <AdminWidthContainer className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <KiddaLogo variant="icon" size="sm" href="/admin/content" branding={branding} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                Admin
              </p>
              <p className="text-sm font-semibold text-zinc-900">Kidda</p>
            </div>
          </div>
          <Link
            href="/dashboard/home"
            className="text-sm font-medium text-zinc-500 hover:text-violet-600"
          >
            App →
          </Link>
        </AdminWidthContainer>
      </header>

      <AdminDataShell data={data} branding={branding} dataSlice={dataSlice}>
        {children}
      </AdminDataShell>

      <AdminBottomNav />
    </div>
  );
}
