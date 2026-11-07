"use client";

import { createPortal } from "react-dom";
import type { ReactNode } from "react";

/**
 * The bottom nav is outside the page stacking context, so a sheet rendered
 * inside the page can never cover it. Portals paint on document.body.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
