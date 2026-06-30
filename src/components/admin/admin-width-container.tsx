"use client";

import { getAdminContainerClass } from "@/lib/admin/admin-layout-width";
import { cn } from "@/lib/ui/styles";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AdminWidthContainerProps = {
  children: ReactNode;
  className?: string;
};

export function AdminWidthContainer({ children, className }: AdminWidthContainerProps) {
  const pathname = usePathname();

  return <div className={cn(getAdminContainerClass(pathname), className)}>{children}</div>;
}
