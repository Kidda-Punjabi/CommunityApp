"use client";

import { AdminDataProvider } from "@/app/admin/content/admin-data-provider";
import { PendingOverlay } from "@/components/navigation/navigation-pending";
import { AdminWidthContainer } from "@/components/admin/admin-width-container";
import type { AdminDataSlice } from "@/lib/admin/merge-admin-data-slice";
import type { AdminData } from "@/app/admin/content/types";
import type { SiteBranding } from "@/lib/branding/types";
import { cn, ui } from "@/lib/ui/styles";

type AdminDataShellProps = {
  data: AdminData;
  branding: SiteBranding;
  dataSlice?: AdminDataSlice;
  children: React.ReactNode;
};

export function AdminDataShell({
  data,
  branding,
  dataSlice = "full",
  children,
}: AdminDataShellProps) {
  return (
    <AdminDataProvider data={data} branding={branding} slice={dataSlice}>
      <AdminWidthContainer
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col px-4 sm:px-5 lg:px-6 xl:px-8",
          ui.navClearance
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          {children}
          <PendingOverlay />
        </div>
      </AdminWidthContainer>
    </AdminDataProvider>
  );
}
