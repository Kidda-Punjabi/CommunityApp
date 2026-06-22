import Link from "next/link";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import { ui } from "@/lib/ui/styles";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: {
    text: string;
    linkText: string;
    href: string;
  };
};

export async function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <KiddaLogo variant="logo" size="lg" href="/" />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">{title}</h1>
          <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
        </div>

        <div className={`${ui.card} p-8`}>{children}</div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {footer.text}{" "}
          <Link href={footer.href} className="font-medium text-violet-600 hover:text-violet-500">
            {footer.linkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
