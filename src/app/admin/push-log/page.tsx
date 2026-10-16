import Link from "next/link";
import { requireAdminFromActions } from "@/app/admin/content/actions";
import { sendTestPushToMe } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPushLogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const params = await searchParams;
  const admin = await requireAdminFromActions();
  let query = admin
    .from("push_send_log")
    .select("id, user_id, type, ref_key, sent_at, status, error, title")
    .order("sent_at", { ascending: false })
    .limit(500);
  if (params.type) query = query.eq("type", params.type);
  if (params.status) query = query.eq("status", params.status);
  const [{ data: rows }, { count: activeDevices }] = await Promise.all([
    query,
    admin
      .from("device_push_tokens")
      .select("id", { count: "exact", head: true })
      .is("disabled_at", null),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      <Link href="/admin/content" className="text-sm font-medium text-violet-700">
        ← Admin
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Push log</h1>
          <p className="mt-1 text-sm text-zinc-500">{activeDevices ?? 0} active devices</p>
        </div>
        <form action={sendTestPushToMe}>
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Send test push to me
          </button>
        </form>
      </div>

      <form className="mt-5 flex flex-wrap gap-2" method="get">
        <input
          name="type"
          defaultValue={params.type ?? ""}
          placeholder="Type"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <input
          name="status"
          defaultValue={params.status ?? ""}
          placeholder="Status"
          className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg border border-zinc-200 px-3 py-2 text-sm">
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-zinc-100 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((row) => (
              <tr key={row.id} className="border-b border-zinc-50">
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600">
                  {new Date(row.sent_at as string).toLocaleString("en-GB")}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-900">{row.type}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2 text-zinc-700">{row.title}</td>
                <td className="px-3 py-2 text-zinc-500">{row.error}</td>
              </tr>
            ))}
            {(rows ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-zinc-500">
                  No push rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
