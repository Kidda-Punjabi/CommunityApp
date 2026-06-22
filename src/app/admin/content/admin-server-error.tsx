import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type AdminServerErrorProps = {
  title?: string;
  message: string;
};

export function AdminServerError({
  title = "Admin panel could not load",
  message,
}: AdminServerErrorProps) {
  const isServiceRole = message.includes("SUPABASE_SERVICE_ROLE_KEY");

  return (
    <div className={`${ui.cardBordered} mx-auto max-w-lg`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
        Server error
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-3 text-sm text-zinc-600">{message}</p>

      {isServiceRole && (
        <div className="mt-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">Fix on Vercel</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Supabase → Project Settings → API → copy the <strong>service_role</strong>{" "}
              secret key
            </li>
            <li>
              Vercel → your project → Settings → Environment Variables → add{" "}
              <code className="rounded bg-white px-1">SUPABASE_SERVICE_ROLE_KEY</code>
            </li>
            <li>Redeploy the app</li>
          </ol>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard/profile" className={ui.btnSecondary}>
          Back to profile
        </Link>
        <Link href="/admin/content" className={ui.btnPrimary}>
          Reload admin
        </Link>
      </div>
    </div>
  );
}
