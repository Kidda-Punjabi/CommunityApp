import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist, Geist_Mono, Poppins } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { after } from "next/server";
import { noteRequest } from "@/lib/perf/context";
import { persistTrace } from "@/lib/perf/persist";
import { Suspense } from "react";
import { AuthRedirectHandler } from "@/components/auth-redirect-handler";
import { NavigationPendingProvider } from "@/components/navigation/navigation-pending";
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
  weight: ["400", "500", "600", "700", "800"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Crisp Gurmukhi for flashcards. Self-hosted: next/font/google fails this
// family because Google Fonts returns extensionless URLs (Next.js #99114).
const notoGurmukhi = localFont({
  src: "./fonts/noto-sans-gurmukhi.woff2",
  variable: "--font-noto-gurmukhi",
  weight: "100 900",
  display: "swap",
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
  const headerList = await headers();
  const nativeApp = isNativeAppRequest(headerList);
  if (process.env.PERF_TRACE === "1") {
    const trace = noteRequest(headerList);
    if (trace) after(() => persistTrace(trace));
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${dmSans.variable} ${notoGurmukhi.variable} min-h-dvh bg-zinc-50 antialiased${nativeApp ? " kidda-native" : ""}`}
    >
      <body className="flex min-h-dvh flex-1 flex-col bg-zinc-50">
        <NativeAppProvider isNative={nativeApp}>
          <NavigationPendingProvider>
            <NativeBridge />
            <PushManager />
            <Suspense fallback={null}>
              <AuthRedirectHandler />
            </Suspense>
            {children}
          </NavigationPendingProvider>
        </NativeAppProvider>
      </body>
    </html>
  );
}
