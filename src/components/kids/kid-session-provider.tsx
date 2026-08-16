"use client";

import { createContext, useContext } from "react";
import type { KidProfile } from "@/lib/kids/types";

type KidSessionContextValue = {
  activeKidProfile: KidProfile | null;
  hasPin: boolean;
  pinUnlocked: boolean;
  hasKidProfiles: boolean;
  parentInitial: string;
  forumBlocked: boolean;
};

const KidSessionContext = createContext<KidSessionContextValue>({
  activeKidProfile: null,
  hasPin: false,
  pinUnlocked: false,
  hasKidProfiles: false,
  parentInitial: "P",
  forumBlocked: false,
});

export function KidSessionProvider({
  children,
  activeKidProfile,
  hasPin,
  pinUnlocked,
  hasKidProfiles,
  parentInitial,
}: {
  children: React.ReactNode;
  activeKidProfile: KidProfile | null;
  hasPin: boolean;
  pinUnlocked: boolean;
  hasKidProfiles: boolean;
  parentInitial: string;
}) {
  return (
    <KidSessionContext.Provider
      value={{
        activeKidProfile,
        hasPin,
        pinUnlocked,
        hasKidProfiles,
        parentInitial,
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
