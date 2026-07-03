"use client";

import type { AdminData } from "@/app/admin/content/types";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import type { AdminDataSlice } from "@/lib/admin/merge-admin-data-slice";
import { useEffect } from "react";

type AdminDataHydratorProps = {
  data: AdminData;
  slice: AdminDataSlice;
};

export function AdminDataHydrator({ data, slice }: AdminDataHydratorProps) {
  const { hydrateData } = useAdminData();

  useEffect(() => {
    hydrateData(data, slice);
  }, [data, slice, hydrateData]);

  return null;
}
