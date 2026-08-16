import {
  CertificateDownloadStub,
  CertificateShareButton,
} from "@/components/learn/certificate-actions";
import { BackLink } from "@/components/navigation/back-link";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import {
  CERTIFICATE_CEFR_DISCLAIMER,
  MOCK_BEGINNER_CERTIFICATE,
  MOCK_CERTIFICATE_MILESTONES,
} from "@/lib/learn/certificate-mock";
import { getDisplayName } from "@/lib/profile/display-name";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { Check } from "lucide-react";
import { redirect } from "next/navigation";

export default async function BeginnerCertificatePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .maybeSingle();

  const studentName =
    getDisplayName(profile) ?? user.email?.split("@")[0] ?? "Student";
  const cert = MOCK_BEGINNER_CERTIFICATE;

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn/certificates">← Certificates</BackLink>

      <div className="mt-4 overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-amber-50 p-6 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]">
        <div className="flex items-center justify-between">
          <KiddaLogo variant="wordmark" size="sm" />
          <span className="rounded-full bg-violet-600/10 px-2.5 py-1 text-[11px] font-semibold text-violet-800">
            CEFR {cert.cefr}
          </span>
        </div>
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-500">
          Certificate of completion
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold text-zinc-900">{studentName}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          has been awarded the Kidda {cert.title} certificate
        </p>
        <p className="mt-4 text-xs font-medium text-zinc-500">Awarded {cert.awardedOn}</p>
      </div>

      <div className="mt-5 flex gap-3">
        <CertificateDownloadStub />
        <CertificateShareButton />
      </div>

      <div className="mt-8">
        <h2 className="font-heading text-sm font-semibold text-zinc-900">Milestones</h2>
        <ul className="mt-3 space-y-2">
          {MOCK_CERTIFICATE_MILESTONES.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-800 shadow-[0_2px_12px_-4px_rgba(24,24,27,0.06)]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-4 w-4" aria-hidden />
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-500">
        {CERTIFICATE_CEFR_DISCLAIMER}
      </p>
    </div>
  );
}
