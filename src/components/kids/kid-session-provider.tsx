"use client";

import { createContext, useContext } from "react";
import type { KidProfile } from "@/lib/kids/types";

type KidSessionContextValue = {
  activeKidProfile: KidProfile | null;
  hasPin: boolean;
  pinUnlocked: boolean;
  forumBlocked: boolean;
};

const KidSessionContext = createContext<KidSessionContextValue>({
  activeKidProfile: null,
  hasPin: false,
  pinUnlocked: false,
  forumBlocked: false,
});

export function KidSessionProvider({
  children,
  activeKidProfile,
  hasPin,
  pinUnlocked,
}: {
  children: React.ReactNode;
  activeKidProfile: KidProfile | null;
  hasPin: boolean;
  pinUnlocked: boolean;
}) {
  return (
    <KidSessionContext.Provider
      value={{
        activeKidProfile,
        hasPin,
        pinUnlocked,
        forumBlocked: activeKidProfile !== null,
      }}
    >
      {children}
    </KidSessionContext.Provider>
  );
}

export function useKidSession() {
  return useContext(KidSessionContext);
}
