"use client";

import type { AdminData } from "./types";
import type { SiteBranding } from "@/lib/branding/types";
import { createContext, useContext } from "react";

type AdminDataContextValue = {
  data: AdminData;
  branding: SiteBranding;
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({
  data,
  branding,
  children,
}: AdminDataContextValue & { children: React.ReactNode }) {
  return (
    <AdminDataContext.Provider value={{ data, branding }}>{children}</AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataContextValue {
  const value = useContext(AdminDataContext);
  if (!value) {
    throw new Error("useAdminData must be used within AdminDataProvider");
  }
  return value;
}
