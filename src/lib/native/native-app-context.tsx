"use client";

import { createContext, useContext } from "react";

const NativeAppContext = createContext(false);

export function NativeAppProvider({
  isNative,
  children,
}: {
  isNative: boolean;
  children: React.ReactNode;
}) {
  return <NativeAppContext.Provider value={isNative}>{children}</NativeAppContext.Provider>;
}

/** True on the first render inside the iOS app. Seeded by the server from the KiddaApp user agent. */
export function useNativeApp(): boolean {
  return useContext(NativeAppContext);
}
