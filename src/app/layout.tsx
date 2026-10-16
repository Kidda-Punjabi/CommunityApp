import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Poppins } from "next/font/google";
import { headers } from "next/headers";
import { Suspense } from "react";
import { AuthRedirectHandler } from "@/components/auth-redirect-handler";
import { NativeBridge } from "@/components/native/native-bridge";
import { PushManager } from "@/components/native/push-manager";
import { loadSiteBranding } from "@/lib/branding/load-site-branding";
import { NativeAppProvider } from "@/lib/native/native-app-context";
import { isNativeAppRequest } from "@/lib/native/platform";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await loadSiteBranding();

  return {
    title: "Kidda",
    description: "Kidda community membership platform",
    icons: branding.faviconUrl
      ? {
          icon: [{ url: branding.faviconUrl }],
          shortcut: branding.faviconUrl,
        }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#fafafa",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nativeApp = isNativeAppRequest(await headers());

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} min-h-dvh bg-zinc-50 antialiased${nativeApp ? " kidda-native" : ""}`}
    >
      <body className="flex min-h-dvh flex-1 flex-col bg-zinc-50">
        <NativeAppProvider isNative={nativeApp}>
          <NativeBridge />
          <PushManager />
          <Suspense fallback={null}>
            <AuthRedirectHandler />
          </Suspense>
          {children}
        </NativeAppProvider>
      </body>
    </html>
  );
}
