import { CertificatePdfPanel } from "@/components/learn/certificate-pdf-panel";
import { BackLink } from "@/components/navigation/back-link";
import { certificateCefrDisclaimer } from "@/lib/learn/certificate-mock";
import { certificatePdfFileName } from "@/lib/learn/certificate-pdf";
import { loadBeginnerCertificateAward } from "@/lib/learn/certificate-student";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function BeginnerCertificatePage() {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const { supabase, user } = session;
  const award = await loadBeginnerCertificateAward(supabase, user);
  const fileName = certificatePdfFileName(award.studentName, award.courseTitle);

  return (
    <div className={ui.page}>
      <BackLink href="/dashboard/learn/certificates">← Certificates</BackLink>

      <div className="mb-2 mt-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          {award.courseTitle} certificate
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Awarded to {award.studentName}
          {award.awardedOn ? ` · ${award.awardedOn}` : ""}
        </p>
      </div>

      <CertificatePdfPanel
        fileName={fileName}
        shareTitle={`Kidda ${award.courseTitle} Certificate`}
      />

      <p className="mt-8 text-center text-[11px] leading-relaxed text-zinc-500">
        {certificateCefrDisclaimer(award.cefr)}
      </p>
    </div>
  );
}
