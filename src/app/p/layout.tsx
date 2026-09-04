import { KiddaLogo } from "@/components/branding/kidda-logo";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200/80 bg-white px-5 py-4">
        <KiddaLogo variant="logo" size="sm" />
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8">{children}</main>
    </div>
  );
}
