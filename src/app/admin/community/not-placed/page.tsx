import { suggestPod } from "@/app/admin/community/actions";
import { loadUnplacedMembers } from "@/lib/community/not-placed";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export default async function NotPlacedPage() {
  const admin = createServiceRoleClient();
  const members = await loadUnplacedMembers(admin);
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-zinc-900">Community members not placed</h1>
      <p className="text-sm text-zinc-600">{members.length} member{members.length === 1 ? "" : "s"}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-2">Member</th>
              <th>Level test</th>
              <th>Pod</th>
              <th>Days</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const text = encodeURIComponent(`Hi ${member.name}, your 2-minute Punjabi level test is waiting in Kidda.`);
              const whatsapp = member.phone
                ? `https://wa.me/${member.phone.replace(/\D/g, "")}?text=${text}`
                : `https://wa.me/?text=${text}`;
              return (
                <tr key={member.userId} className="border-t border-zinc-100">
                  <td className="py-3">
                    <span className="block font-medium text-zinc-900">{member.name}</span>
                    <span className="text-xs text-zinc-500">{member.timezone} · {member.sessionTitle ?? "No main session"}</span>
                  </td>
                  <td>
                    {member.level == null ? (
                      <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-violet-700">Send test</a>
                    ) : (
                      `Level ${member.level}`
                    )}
                  </td>
                  <td>
                    {member.podName ? (
                      member.podName
                    ) : member.level != null && member.sessionTitle ? (
                      <form action={async () => {
                        "use server";
                        await suggestPod(member.userId);
                      }}>
                        <button type="submit" className={ui.btnSecondary}>Suggest pod</button>
                      </form>
                    ) : (
                      "Suggest pod"
                    )}
                  </td>
                  <td className={member.days > 7 ? "font-semibold text-red-600" : ""}>{member.days}</td>
                  <td>
                    <a href={whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-violet-700">WhatsApp reminder</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
