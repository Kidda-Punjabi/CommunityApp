"use client";

import type { AdminData } from "./types";
import type { SiteBranding } from "@/lib/branding/types";
import {
  mergeAdminDataSlice,
  type AdminDataSlice,
} from "@/lib/admin/merge-admin-data-slice";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type AdminDataContextValue = {
  data: AdminData;
  branding: SiteBranding;
  hydrateData: (patch: AdminData, slice: AdminDataSlice) => void;
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

type AdminDataProviderProps = {
  data: AdminData;
  branding: SiteBranding;
  slice?: AdminDataSlice;
  children: React.ReactNode;
};

export function AdminDataProvider({
  data,
  branding,
  slice = "full",
  children,
}: AdminDataProviderProps) {
  const [state, setState] = useState({ data, branding });

  useEffect(() => {
    setState((prev) => ({
      branding,
      data: mergeAdminDataSlice(prev.data, data, slice),
    }));
  }, [data, branding, slice]);

  const hydrateData = useCallback((patch: AdminData, patchSlice: AdminDataSlice) => {
    setState((prev) => ({
      ...prev,
      data: mergeAdminDataSlice(prev.data, patch, patchSlice),
    }));
  }, []);

  const value = useMemo(
    () => ({
      data: state.data,
      branding: state.branding,
      hydrateData,
    }),
    [state.data, state.branding, hydrateData]
  );

  return (
    <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataContextValue {
  const value = useContext(AdminDataContext);
  if (!value) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return value;
}
