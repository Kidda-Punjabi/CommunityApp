"use client";

import { AdminDataProvider } from "@/app/admin/content/admin-data-provider";
import type { AdminData } from "@/app/admin/content/types";
import type { SiteBranding } from "@/lib/branding/types";
import { ui } from "@/lib/ui/styles";

type AdminDataShellProps = {
  data: AdminData;
  branding: SiteBranding;
  children: React.ReactNode;
};

export function AdminDataShell({ data, branding, children }: AdminDataShellProps) {
  return (
    <AdminDataProvider data={data} branding={branding}>
      <div className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${ui.navClearance}`}>
        {children}
      </div>
    </AdminDataProvider>
  );
}
