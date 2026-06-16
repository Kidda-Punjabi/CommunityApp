import Link from "next/link";

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

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-widest text-violet-600"
          >
            Kidda
          </Link>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">
            {title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          {children}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {footer.text}{" "}
          <Link
            href={footer.href}
            className="font-medium text-violet-600 hover:text-violet-500"
          >
            {footer.linkText}
          </Link>
        </p>
      </div>
    </div>
  );
}
